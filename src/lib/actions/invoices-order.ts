'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { requireFinanceRole } from '@/lib/rbac'
import { getInvoiceConfig } from '@/lib/actions/invoice-config'
import { getServiceReport } from '@/lib/service-report'
import { ServiceReportMissingError, type CreateInvoiceFromOrderResult } from '@/lib/invoice-errors'
import { generateInvoiceNumber, getOrderItemsForInvoice } from './invoices-queries'
import { createInvoice } from './invoices-create'
import type { CreateInvoiceInput } from './invoices-types'

export async function createProformaInvoice(orderId: string): Promise<{
  success: boolean
  data?: { invoice_id: string; invoice_number: string; total_amount: number }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { userId } = await auth()
    await requireFinanceRole(userId)

    const { data: order, error: orderError } = await supabase
      .from('orders').select('order_id, customer_id, status').eq('order_id', orderId).maybeSingle()
    if (orderError || !order) return { success: false, error: 'Order tidak ditemukan' }
    if (!order.customer_id) return { success: false, error: 'Order tidak memiliki customer terhubung' }

    // ponytail: status gate — orders past proforma stage cannot get a new proforma
    if (['COMPLETED', 'DONE', 'INVOICED', 'PAID'].includes(order.status)) {
      return { success: false, error: 'Order sudah melewati tahap proforma' }
    }

    // ponytail: duplicate check — return existing PROFORMA if one already exists
    const { data: existing, error: existingError } = await supabase
      .from('invoices').select().eq('order_id', orderId).eq('invoice_type', 'PROFORMA').maybeSingle()
    if (existingError) {
      logger.error('Error checking existing proforma:', existingError)
    }
    if (existing) {
      return {
        success: true,
        data: { invoice_id: existing.invoice_id, invoice_number: existing.invoice_number, total_amount: existing.total_amount },
      }
    }

    const orderItems = await getOrderItemsForInvoice(orderId)
    const baseServiceItems: CreateInvoiceInput['items'] = orderItems.map((oi) => ({
      item_type: 'BASE_SERVICE',
      description: [oi.serviceName, oi.unitTypeName ? `— ${oi.unitTypeName}` : null, oi.capacityLabel ? `(${oi.capacityLabel})` : null, oi.msnCode ? `· MSN ${oi.msnCode}` : null].filter(Boolean).join(' '),
      quantity: oi.quantity, unit_price: oi.estimatedPrice, service_type: oi.serviceType,
    }))

    const { data: orderAddons } = await supabase
      .from('order_addons').select(`order_addon_id, addon_id, quantity, unit_price, notes, addon_catalog ( item_name )`).eq('order_id', orderId)

    const addonItems: CreateInvoiceInput['items'] = (orderAddons || []).map((row) => {
      const addonRow = row as unknown as Record<string, unknown>
      const addonCatalog = addonRow.addon_catalog as Record<string, unknown> | null
      const itemName = (addonCatalog?.item_name as string | undefined) || (addonRow.notes as string | undefined) || 'Add-on'
      return {
        item_type: 'ADDON', description: itemName,
        quantity: Number(addonRow.quantity) || 1, unit_price: Number(addonRow.unit_price) || 0,
        addon_id: (addonRow.addon_id as string | undefined) || undefined,
        order_addon_id: (addonRow.order_addon_id as string | undefined) || undefined,
      }
    })

    const items = [...baseServiceItems, ...addonItems]
    if (items.length === 0) return { success: false, error: 'Order tidak memiliki item yang bisa di-invoice' }

    const baseServiceTotal = baseServiceItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
    const addonsSubtotal = addonItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
    const subtotal = baseServiceTotal + addonsSubtotal
    const config = await getInvoiceConfig()
    const taxPercentage = config?.default_tax_percentage ?? 11
    const taxAmount = (subtotal * taxPercentage) / 100
    const totalAmount = subtotal + taxAmount

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (config?.default_due_days ?? 30))

    const primaryServiceType = orderItems[0]?.serviceType ?? 'PROFORMA'
    const primaryServiceName = orderItems.length > 1 ? 'Multiple Services' : orderItems[0]?.serviceName ?? 'Service'

    const invoiceNumber = await generateInvoiceNumber()
    const todayISO = new Date().toISOString().split('T')[0]

    const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber, invoice_type: 'PROFORMA', order_id: orderId,
      customer_id: order.customer_id, invoice_date: todayISO,
      due_date: dueDate.toISOString().split('T')[0], service_type: primaryServiceType,
      service_name: primaryServiceName, base_service_quantity: 1,
      base_service_price: baseServiceTotal, base_service_total: baseServiceTotal,
      addons_subtotal: addonsSubtotal, subtotal, discount_amount: 0, discount_percentage: 0,
      tax_percentage: taxPercentage, tax_amount: taxAmount, total_amount: totalAmount,
      status: 'DRAFT', payment_status: 'UNPAID', paid_amount: 0,
      notes: 'Proforma invoice — generated automatically dari order baru.',
      terms_conditions: config?.terms_conditions_template || null, created_by: userId,
    }).select().single()

    if (invoiceError || !invoice) {
      logger.error('Error creating proforma invoice:', invoiceError)
      return { success: false, error: invoiceError?.message || 'Gagal membuat proforma invoice' }
    }

    const itemsToInsert = items.map((item, index) => ({
      invoice_id: invoice.invoice_id, item_type: item.item_type, description: item.description,
      quantity: item.quantity, unit_price: item.unit_price, total_price: item.quantity * item.unit_price,
      service_type: item.service_type || null, addon_id: item.addon_id || null,
      order_addon_id: item.order_addon_id || null, line_order: index,
    }))

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
    if (itemsError) {
      logger.error('Error creating proforma invoice items:', itemsError)
      await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
      return { success: false, error: itemsError.message || 'Gagal membuat invoice items' }
    }

    revalidatePath('/dashboard/keuangan/invoices')
    return {
      success: true,
      data: { invoice_id: invoice.invoice_id, invoice_number: invoice.invoice_number, total_amount: invoice.total_amount },
    }
  } catch (error) {
    logger.error('createProformaInvoice failed:', error)
    return { success: false, error: (error as { message?: string })?.message || 'Gagal membuat proforma invoice' }
  }
}

export async function createInvoiceFromOrder(orderId: string): Promise<CreateInvoiceFromOrderResult> {
  const supabase = await createClient()
  const { userId } = await auth()
  await requireFinanceRole(userId)

  const { data: existingInvoice } = await supabase
    .from('invoices').select('invoice_id, invoice_number, total_amount').eq('order_id', orderId).maybeSingle()
  if (existingInvoice) {
    return { invoice_id: existingInvoice.invoice_id, invoice_number: existingInvoice.invoice_number, total_amount: existingInvoice.total_amount, source: 'SERVICE_REPORT' }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders').select('order_id, customer_id, status').eq('order_id', orderId).maybeSingle()
  if (orderError || !order) throw new Error('Order tidak ditemukan')

  const acceptableStatuses = ['COMPLETED', 'DONE']
  if (!acceptableStatuses.includes(order.status)) {
    throw new Error(`Order belum siap untuk invoice (status: ${order.status}). Tunggu teknisi submit laporan terlebih dahulu.`)
  }
  if (!order.customer_id) throw new Error('Order tidak memiliki customer terhubung')

  const report = await getServiceReport(orderId)
  if (!report) throw new ServiceReportMissingError(orderId)

  const orderItems = await getOrderItemsForInvoice(orderId)

  const baseServiceItems: CreateInvoiceInput['items'] = orderItems.map((oi) => ({
    item_type: 'BASE_SERVICE',
    description: [oi.serviceName, oi.unitTypeName ? `— ${oi.unitTypeName}` : null, oi.capacityLabel ? `(${oi.capacityLabel})` : null, oi.msnCode ? `· MSN ${oi.msnCode}` : null].filter(Boolean).join(' '),
    quantity: oi.quantity, unit_price: oi.estimatedPrice, service_type: oi.serviceType,
  }))

  // Filter: catalog materials (addon_id set) always included.
  // Manual materials (is_manual, addon_id null) only included if their
  // addon_request was APPROVED. PENDING/REJECTED are skipped.
  const manualNames = report.materials
    .filter((m) => m.is_manual && !m.addon_id)
    .map((m) => m.name)

  let approvedManualNames = new Set<string>()
  if (manualNames.length > 0) {
    const { data: approvedReqs } = await supabase
      .from('addon_requests')
      .select('item_name')
      .in('item_name', manualNames)
      .eq('status', 'APPROVED')
    if (approvedReqs) {
      approvedManualNames = new Set(approvedReqs.map((r) => r.item_name))
    }
  }

  const materialItems: CreateInvoiceInput['items'] = report.materials
    .filter((m) => {
      if (m.addon_id) return true
      if (m.is_manual) return approvedManualNames.has(m.name)
      return true
    })
    .map((m) => ({
      item_type: 'ADDON', description: m.name, quantity: m.qty, unit_price: m.unit_price, addon_id: m.addon_id ?? undefined,
    }))

  const items = [...baseServiceItems, ...materialItems]
  if (items.length === 0) throw new Error('Order tidak memiliki item yang bisa di-invoice')

  const baseServicePrice = baseServiceItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
  const config = await getInvoiceConfig()
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (config?.default_due_days ?? 30))

  const primaryServiceType = orderItems[0]?.serviceType ?? 'SERVICE'
  const primaryServiceName = orderItems[0]?.serviceName ?? 'Service'

  const invoice = await createInvoice({
    order_id: orderId, customer_id: order.customer_id, invoice_type: 'FINAL',
    due_date: dueDate.toISOString().split('T')[0], service_type: primaryServiceType,
    service_name: primaryServiceName, base_service_price: baseServicePrice, items,
    notes: `Auto-populated dari service report ${report.report_id}.` + (report.notes ? `\n\nCatatan teknisi:\n${report.notes}` : ''),
    tax_percentage: config?.default_tax_percentage ?? 11,
  })

  return { invoice_id: invoice.invoice_id, invoice_number: invoice.invoice_number, total_amount: invoice.total_amount, source: 'SERVICE_REPORT' }
}

export async function finalizeInvoiceFromOrder(orderId: string): Promise<CreateInvoiceFromOrderResult> {
  // Security: only finance role can finalize
  const supabase = await createClient()
  const { userId } = await auth()
  await requireFinanceRole(userId)

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('invoice_id, invoice_type')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingInvoice?.invoice_type === 'PROFORMA') {
    const admin = createAdminClient()
    const invoiceId = existingInvoice.invoice_id

    await admin.from('invoice_communications').delete().eq('invoice_id', invoiceId)
    await admin.from('payment_records').delete().eq('invoice_id', invoiceId)
    await admin.from('invoice_items').delete().eq('invoice_id', invoiceId)

    const { error: invoiceError } = await admin
      .from('invoices')
      .delete()
      .eq('invoice_id', invoiceId)
    if (invoiceError) {
      logger.error('Error deleting proforma invoice:', invoiceError)
      throw new Error('Gagal menghapus proforma invoice')
    }
  }

  const result = await createInvoiceFromOrder(orderId)
  // ponytail: finalize implies sending — transition DRAFT → SENT; ceiling: no optimistic lock
  const adminClient = createAdminClient()
  await adminClient.from('invoices').update({ status: 'SENT', updated_at: new Date().toISOString() }).eq('invoice_id', result.invoice_id)
  return result
}
