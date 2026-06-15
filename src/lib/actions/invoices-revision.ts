'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { canAccessCustomer, requireFinanceRole, type UserRole } from '@/lib/rbac'
import { canReviseInvoice, REVISABLE_STATUSES, getInvoiceSource } from '@/lib/invoice-utils'
import { calculateDiscount, calculateTax } from '@/lib/utils/money'
import { ALLOWED_REVISION_FIELDS } from './invoices-types'
import type { Invoice, InvoiceRevisionHeaderUpdates, ReviseInvoiceItemInput, InvoiceItem } from './invoices-types'

type InvoiceTotals = {
  subtotal: number
  addons_subtotal: number
  tax_amount: number
  total_amount: number
}

type InvoiceAdjustments = {
  discount_amount: number | null
  discount_percentage: number | null
  tax_percentage: number | null
}

const allowedRevisionFieldSet = new Set<string>(ALLOWED_REVISION_FIELDS)

type AccessScopedUser = { role: UserRole | null }

async function getAccessScopedUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<AccessScopedUser> {
  const { data: roleRow } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()
  return { role: (roleRow?.role as UserRole | null | undefined) ?? null }
}

export async function assertCustomerIsVisibleOrThrow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId) return
  const { data: customer, error } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (error || !customer) throw new Error('Customer tidak valid atau tidak dapat diakses')
  const accessUser = await getAccessScopedUser(supabase, userId)
  if (!canAccessCustomer(accessUser, customer)) throw new Error('Customer tidak valid atau tidak dapat diakses')
}

export async function assertCustomerExistsForBlankInvoiceOrThrow(
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId) return
  const admin = createAdminClient()
  const { data: customer, error } = await admin
    .from('customers')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (error || !customer) throw new Error('Customer tidak valid atau tidak ditemukan')
}

function pickAllowedRevisionUpdates(updates: InvoiceRevisionHeaderUpdates): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedRevisionFieldSet.has(key))
  )
}

function calculateInvoiceTotals(
  subtotal: number,
  adjustments: InvoiceAdjustments,
  items?: Array<{ item_type?: string; total_price?: number; quantity?: number; unit_price?: number }>
): InvoiceTotals {
  const safeSubtotal = Math.max(0, subtotal)
  const discountAmountInput = adjustments.discount_amount ?? 0
  const discountPercentage = adjustments.discount_percentage ?? 0
  const hasFixedDiscount = discountAmountInput > 0
  const discountAmount = calculateDiscount(
    safeSubtotal,
    hasFixedDiscount ? 'FIXED' : 'PERCENTAGE',
    hasFixedDiscount ? discountAmountInput : discountPercentage
  )
  const taxPercentage = adjustments.tax_percentage ?? 0
  const taxableBase = Math.max(0, safeSubtotal - discountAmount)
  const taxAmount = calculateTax(taxableBase, taxPercentage)
  const addonsSubtotal = items
    ? items.filter((i) => i.item_type === 'ADDON')
        .reduce((sum, i) => sum + (i.total_price ?? (i.quantity ?? 0) * (i.unit_price ?? 0)), 0)
    : 0
  return { subtotal: safeSubtotal, addons_subtotal: addonsSubtotal, tax_amount: taxAmount, total_amount: taxableBase + taxAmount }
}

async function calculateTotalsFromInvoiceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  adjustments: InvoiceAdjustments
): Promise<InvoiceTotals> {
  const { data: items, error } = await supabase
    .from('invoice_items')
    .select('item_type, quantity, unit_price, total_price')
    .eq('invoice_id', invoiceId)
  if (error) {
    logger.error('Error fetching invoice items for totals:', error)
    throw new Error('Gagal menghitung ulang total invoice')
  }
  const subtotal = (items || []).reduce((sum, item) => {
    const totalPrice = item.total_price ?? item.quantity * item.unit_price
    return sum + totalPrice
  }, 0)
  return calculateInvoiceTotals(subtotal, adjustments, items || [])
}

function normalizeRevisionItems(
  invoiceId: string,
  items: ReviseInvoiceItemInput[]
): Array<Omit<InvoiceItem, 'item_id' | 'created_at'>> {
  if (items.length === 0) throw new Error('Minimal satu item invoice')
  return items.map((item, index) => {
    const description = item.description?.trim()
    if (!description) throw new Error('Deskripsi item wajib diisi')
    if (!(item.quantity > 0)) throw new Error('Kuantitas item harus lebih dari 0')
    if (item.unit_price < 0) throw new Error('Harga satuan tidak boleh negatif')
    return {
      invoice_id: invoiceId,
      item_type: item.item_type || 'BASE_SERVICE',
      description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      service_type: item.service_type || null,
      addon_id: item.addon_id || null,
      order_addon_id: item.order_addon_id || null,
      line_order: item.line_order ?? index,
    }
  })
}

export async function updateInvoice(
  invoiceId: string,
  updates: InvoiceRevisionHeaderUpdates
): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, order_id, discount_amount, discount_percentage, tax_percentage')
    .eq('invoice_id', invoiceId)
    .single()
  if (fetchError || !currentInvoice) throw new Error('Invoice tidak ditemukan')
  if (!canReviseInvoice(currentInvoice.status)) throw new Error('Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT')

  const safeUpdates = pickAllowedRevisionUpdates(updates)
  await assertCustomerIsVisibleOrThrow(supabase, user!.id, (safeUpdates.customer_id as string | null | undefined) ?? null)

  const shouldRecomputeTotals =
    'discount_amount' in safeUpdates || 'discount_percentage' in safeUpdates || 'tax_percentage' in safeUpdates

  if (shouldRecomputeTotals) {
    Object.assign(safeUpdates, await calculateTotalsFromInvoiceItems(supabase, invoiceId, {
      discount_amount: (safeUpdates.discount_amount as number | null | undefined) ?? currentInvoice.discount_amount,
      discount_percentage: (safeUpdates.discount_percentage as number | null | undefined) ?? currentInvoice.discount_percentage,
      tax_percentage: (safeUpdates.tax_percentage as number | null | undefined) ?? currentInvoice.tax_percentage,
    }))
  }

  if (Object.keys(safeUpdates).length === 0) {
    const { data: unchangedInvoice, error: unchangedError } = await supabase
      .from('invoices').select('*').eq('invoice_id', invoiceId).single()
    if (unchangedError || !unchangedInvoice) throw new Error('Invoice tidak ditemukan')
    return { ...unchangedInvoice, source: getInvoiceSource(unchangedInvoice) }
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .in('status', [...REVISABLE_STATUSES])
    .select().single()
  if (error) {
    logger.error('Error updating invoice:', error)
    throw new Error('Gagal mengupdate invoice')
  }
  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { ...data, source: getInvoiceSource(data) }
}

export async function reviseInvoiceItems(
  invoiceId: string,
  items: ReviseInvoiceItemInput[]
): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, discount_amount, discount_percentage, tax_percentage, subtotal, addons_subtotal, tax_amount, total_amount')
    .eq('invoice_id', invoiceId).single()
  if (fetchError || !currentInvoice) throw new Error('Invoice tidak ditemukan')
  if (!canReviseInvoice(currentInvoice.status)) throw new Error('Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT')

  const replacementItems = normalizeRevisionItems(invoiceId, items)

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('line_order', { ascending: true })
  if (existingItemsError) {
    logger.error('Error fetching current invoice items:', existingItemsError)
    throw new Error('Gagal memuat item invoice')
  }

  const restoreItems = (existingItems || []).map(({ item_id: _itemId, created_at: _createdAt, ...item }) => item)
  const previousTotals = {
    subtotal: currentInvoice.subtotal, addons_subtotal: currentInvoice.addons_subtotal,
    tax_amount: currentInvoice.tax_amount, total_amount: currentInvoice.total_amount,
  }

  const restoreOriginalItems = async (context: string) => {
    const { error: clearError } = await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    if (clearError) {
      logger.error('Failed to clear revised invoice items during restore:', { context, invoiceId, error: clearError })
    }
    if (restoreItems.length === 0) return
    const { error: restoreError } = await supabase.from('invoice_items').insert(restoreItems)
    if (restoreError) {
      logger.error('Failed to restore original invoice items:', { context, invoiceId, error: restoreError })
    }
  }

  const { error: deleteError } = await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
  if (deleteError) {
    logger.error('Error deleting invoice items for revision:', deleteError)
    throw new Error('Gagal merevisi item invoice')
  }

  const { error: insertError } = await supabase.from('invoice_items').insert(replacementItems)
  if (insertError) {
    logger.error('Error inserting revised invoice items:', insertError)
    await restoreOriginalItems('insert_revised_items_failed')
    throw new Error('Gagal menyimpan item invoice')
  }

  const totals = calculateInvoiceTotals(
    replacementItems.reduce((sum, item) => sum + item.total_price, 0),
    currentInvoice,
    replacementItems
  )

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({ ...totals, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .in('status', [...REVISABLE_STATUSES])
    .select().single()
  if (updateError || !updatedInvoice) {
    logger.error('Error updating invoice totals after item revision:', updateError)
    await restoreOriginalItems('update_invoice_totals_failed')
    await supabase.from('invoices').update({ ...previousTotals, updated_at: new Date().toISOString() }).eq('invoice_id', invoiceId)
    throw new Error('Gagal menghitung ulang total invoice')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { ...updatedInvoice, source: getInvoiceSource(updatedInvoice) }
}

export async function reviseInvoice(
  invoiceId: string,
  headerUpdates: InvoiceRevisionHeaderUpdates,
  items: ReviseInvoiceItemInput[]
): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)
  await updateInvoice(invoiceId, headerUpdates)
  return reviseInvoiceItems(invoiceId, items)
}
