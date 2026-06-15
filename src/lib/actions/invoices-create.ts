'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { requireFinanceRole } from '@/lib/rbac'
import { getInvoiceSource } from '@/lib/invoice-utils'
import { calculateDiscount, calculateTax } from '@/lib/utils/money'
import { CreateBlankInvoiceSchema, type CreateBlankInvoiceInput } from '@/app/api/schemas'
import { generateInvoiceNumber } from './invoices-queries'
import { assertCustomerIsVisibleOrThrow, assertCustomerExistsForBlankInvoiceOrThrow } from './invoices-revision'
import type { Invoice, CreateInvoiceInput, CreateBlankInvoiceResult } from './invoices-types'

function getBlankInvoiceErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Gagal membuat invoice'
  if (message.includes('Unauthorized')) return 'Anda tidak punya akses untuk membuat invoice'
  if (message.includes('Missing Supabase URL or Service Role Key')) return 'Konfigurasi server belum lengkap: SUPABASE_SERVICE_ROLE_KEY belum tersedia.'
  if (message.includes('Customer')) return message
  if (
    message.includes('source') || message.includes('customer_name_override') ||
    message.includes('order_id') || message.includes('service_type') ||
    message.includes('base_service_price') || message.includes('chk_invoices_source_integrity') ||
    message.includes('violates not-null constraint') || message.includes('violates check constraint')
  ) {
    return 'Database belum siap untuk blank invoice. Jalankan migration 012_add_blank_invoice_support.sql di production.'
  }
  if (message.startsWith('Gagal') || message.includes('wajib') || message.includes('valid')) return message
  return 'Gagal membuat invoice. Cek server log untuk detail error.'
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const invoiceNumber = await generateInvoiceNumber()
  const baseServiceTotal = input.base_service_price
  const addonsSubtotal = input.items
    .filter((item) => item.item_type === 'ADDON')
    .reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const subtotal = baseServiceTotal + addonsSubtotal
  const discountAmount = input.discount_amount || 0
  const discountPercentage = input.discount_percentage || 0
  const taxPercentage = input.tax_percentage || 11
  const taxAmount = ((subtotal - discountAmount) * taxPercentage) / 100
  const totalAmount = subtotal - discountAmount + taxAmount

  const { data: config } = await supabase
    .from('invoice_configuration').select('terms_conditions_template, default_due_days').eq('is_active', true).single()

  const invoiceDate = new Date()
  const dueDate = new Date(
    input.due_date || new Date(invoiceDate.setDate(invoiceDate.getDate() + (config?.default_due_days || 30)))
  )

  await assertCustomerIsVisibleOrThrow(supabase, user!.id, input.customer_id)

  const { data: order, error: orderError } = await supabase
    .from('orders').select('order_id, customer_id, status').eq('order_id', input.order_id).maybeSingle()
  if (orderError || !order) throw new Error('Order tidak valid atau tidak ditemukan')
  if (order.customer_id !== input.customer_id) throw new Error('Order tidak sesuai dengan customer yang dipilih')
  if (!['DONE', 'COMPLETED'].includes(order.status)) throw new Error('Order belum memenuhi syarat untuk pembuatan invoice')

  const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber, invoice_type: input.invoice_type, order_id: input.order_id,
    customer_id: input.customer_id, invoice_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0], service_type: input.service_type,
    service_name: input.service_name, base_service_quantity: 1,
    base_service_price: input.base_service_price, base_service_total: baseServiceTotal,
    addons_subtotal: addonsSubtotal, subtotal, discount_amount: discountAmount,
    discount_percentage: discountPercentage, tax_percentage: taxPercentage,
    tax_amount: taxAmount, total_amount: totalAmount, status: 'DRAFT',
    payment_status: 'UNPAID', paid_amount: 0, notes: input.notes || null,
    terms_conditions: config?.terms_conditions_template || null,
    payment_account_id: input.payment_account_id || null,
    payment_account_label: input.payment_account_label || null,
    payment_bank_name: input.payment_bank_name || null,
    payment_account_number: input.payment_account_number || null,
    payment_account_name: input.payment_account_name || null,
    created_by: user!.id,
  }).select().single()

  if (invoiceError) {
    logger.error('Error creating invoice:', invoiceError)
    throw new Error('Gagal membuat invoice')
  }

  const itemsToInsert = input.items.map((item, index) => ({
    invoice_id: invoice.invoice_id, item_type: item.item_type, description: item.description,
    quantity: item.quantity, unit_price: item.unit_price, total_price: item.quantity * item.unit_price,
    service_type: item.service_type || null, addon_id: item.addon_id || null,
    order_addon_id: item.order_addon_id || null, line_order: index,
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
  if (itemsError) {
    logger.error('Error creating invoice items:', itemsError)
    await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
    throw new Error('Gagal membuat invoice items')
  }

  if (input.invoice_type === 'FINAL' && input.order_id) {
    const { data: order } = await supabase.from('orders').select('status').eq('order_id', input.order_id).single()
    if (order?.status === 'COMPLETED' || order?.status === 'DONE') {
      await supabase.from('orders').update({ status: 'INVOICED', updated_at: new Date().toISOString() }).eq('order_id', input.order_id)
    }
  }

  try { revalidatePath('/dashboard/keuangan/invoices') } catch (error) {
    logger.warn('Skipping revalidatePath because it was called during rendering:', error)
  }
  return { ...invoice, source: getInvoiceSource(invoice) }
}

export async function createBlankInvoice(input: CreateBlankInvoiceInput): Promise<CreateBlankInvoiceResult> {
  try {
    const invoice = await createBlankInvoiceOrThrow(input)
    return { success: true, data: invoice }
  } catch (error) {
    logger.error('createBlankInvoice failed:', error)
    return { success: false, error: getBlankInvoiceErrorMessage(error) }
  }
}

async function createBlankInvoiceOrThrow(input: CreateBlankInvoiceInput): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const parsedInput = CreateBlankInvoiceSchema.parse(input)
  const linkedCustomerId = parsedInput.customer_id?.trim() || null
  await assertCustomerExistsForBlankInvoiceOrThrow(linkedCustomerId)

  const invoiceNumber = await generateInvoiceNumber()
  const { getInvoiceConfig } = await import('@/lib/actions/invoice-config')
  const config = await getInvoiceConfig()

  const todayISO = new Date().toISOString().split('T')[0]
  const invoiceDate = parsedInput.invoice_date || todayISO
  const dueDate = parsedInput.due_date

  const subtotal = parsedInput.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const discountAmountInput = parsedInput.discount_amount ?? 0
  const discountPercentage = parsedInput.discount_percentage || 0
  const hasFixedDiscount = discountAmountInput > 0
  const discountAmount = calculateDiscount(subtotal, hasFixedDiscount ? 'FIXED' : 'PERCENTAGE', hasFixedDiscount ? discountAmountInput : discountPercentage)
  const taxPercentage = parsedInput.tax_percentage ?? config?.default_tax_percentage ?? 11
  const taxableBase = Math.max(0, subtotal - discountAmount)
  const taxAmount = calculateTax(taxableBase, taxPercentage)
  const totalAmount = taxableBase + taxAmount
  const hasLinkedCustomer = Boolean(linkedCustomerId)
  const customerNameOverride = parsedInput.customer_name

  const insertPayload: Record<string, unknown> = {
    invoice_number: invoiceNumber, invoice_type: parsedInput.invoice_type, source: 'BLANK',
    order_id: null, customer_id: linkedCustomerId, customer_name_override: customerNameOverride,
    customer_phone_override: hasLinkedCustomer ? null : parsedInput.customer_phone || null,
    customer_email_override: hasLinkedCustomer ? null : parsedInput.customer_email || null,
    customer_address_override: hasLinkedCustomer ? null : parsedInput.customer_address || null,
    invoice_date: invoiceDate, due_date: dueDate,
    service_type: null, service_name: null, base_service_quantity: 0,
    base_service_price: null, base_service_total: null,
    addons_subtotal: subtotal, subtotal, discount_amount: discountAmount,
    discount_percentage: discountPercentage, tax_percentage: taxPercentage,
    tax_amount: taxAmount, total_amount: totalAmount,
    status: 'DRAFT', payment_status: 'UNPAID', paid_amount: 0,
    notes: parsedInput.notes?.trim() || null,
    terms_conditions: parsedInput.terms_conditions?.trim() || config?.terms_conditions_template || null,
    payment_account_id: parsedInput.payment_account_id || null,
    payment_account_label: parsedInput.payment_account_label || null,
    payment_bank_name: parsedInput.payment_bank_name || null,
    payment_account_number: parsedInput.payment_account_number || null,
    payment_account_name: parsedInput.payment_account_name || null,
    created_by: user!.id,
  }

  const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert(insertPayload).select().single()
  if (invoiceError || !invoice) {
    logger.error('Error creating blank invoice:', invoiceError)
    throw new Error(invoiceError?.message || 'Gagal membuat invoice')
  }

  const itemsToInsert = parsedInput.items.map((item, index) => ({
    invoice_id: invoice.invoice_id, item_type: item.item_type || 'BASE_SERVICE',
    description: item.description.trim(), quantity: item.quantity, unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price, service_type: null,
    addon_id: null, order_addon_id: null, line_order: index,
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
  if (itemsError) {
    logger.error('Error creating blank invoice items:', itemsError)
    await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
    throw new Error(itemsError.message || 'Gagal membuat invoice items')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  return { ...invoice, source: 'BLANK' }
}
