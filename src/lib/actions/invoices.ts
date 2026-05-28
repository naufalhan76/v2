'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { canAccessCustomer, requireFinanceRole, type UserRole } from '@/lib/rbac'
import { isOverdue, type InvoiceStatus } from '@/lib/invoice-status'
import { canReviseInvoice, getInvoiceSource, type InvoiceSource, REVISABLE_STATUSES } from '@/lib/invoice-utils'
import { getInvoiceConfig } from '@/lib/actions/invoice-config'
import { getServiceReport } from '@/lib/service-report'
import {
  CreateBlankInvoiceSchema,
  type CreateBlankInvoiceInput,
} from '@/app/api/schemas'
import { calculateDiscount, calculateTax } from '@/lib/utils/money'

export type { InvoiceStatus }
export type { InvoiceSource }

export interface Invoice {
  invoice_id: string
  invoice_number: string
  invoice_type: 'PROFORMA' | 'FINAL'
  source?: InvoiceSource
  order_id: string | null
  customer_id: string | null
  customer_name_override?: string | null
  customer_phone_override?: string | null
  customer_email_override?: string | null
  customer_address_override?: string | null
  invoice_date: string
  due_date: string
  service_type: string | null
  service_name: string | null
  base_service_quantity: number
  base_service_price: number | null
  base_service_total: number | null
  addons_subtotal: number
  subtotal: number
  discount_amount: number
  discount_percentage: number
  tax_percentage: number
  tax_amount: number
  total_amount: number
  status: InvoiceStatus
  computed_status?: InvoiceStatus
  payment_status: string
  paid_amount: number
  notes: string | null
  terms_conditions: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  customers?: {
    customer_id: string
    customer_name: string
    phone_number: string
    email: string
    billing_address?: string | null
  }
  orders?: {
    order_id: string
    order_type: string
    status: string
  }
}

export interface InvoiceItem {
  item_id: string
  invoice_id: string
  item_type: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  service_type: string | null
  addon_id: string | null
  order_addon_id: string | null
  line_order: number
  created_at: string
}

export interface PaymentRecord {
  payment_id: string
  invoice_id: string
  payment_date: string
  payment_method: string
  amount: number
  reference_number: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export interface CreateInvoiceInput {
  order_id: string
  customer_id: string
  invoice_type: 'PROFORMA' | 'FINAL'
  due_date: string
  service_type: string
  service_name: string
  base_service_price: number
  items: Array<{
    item_type: 'BASE_SERVICE' | 'ADDON'
    description: string
    quantity: number
    unit_price: number
    service_type?: string
    addon_id?: string
    order_addon_id?: string
  }>
  discount_amount?: number
  discount_percentage?: number
  notes?: string
  payment_account_id?: string
  payment_account_label?: string
  payment_bank_name?: string
  payment_account_number?: string
  payment_account_name?: string
  tax_percentage?: number  // Tax from selected payment account
}

function withBlankInvoiceCustomer<T extends Invoice>(invoice: T): T {
  if (invoice.customers || invoice.source !== 'BLANK') {
    return invoice
  }

  const normalizedCustomerName = invoice.customer_name_override?.trim()

  return {
    ...invoice,
    customers: {
      customer_id: invoice.customer_id || '',
      customer_name: normalizedCustomerName || 'Customer',
      phone_number: invoice.customer_phone_override || '',
      email: invoice.customer_email_override || '',
      billing_address: invoice.customer_address_override || null,
    },
  } as T
}

const ALLOWED_REVISION_FIELDS = [
  'customer_id',
  'customer_name_override',
  'customer_phone_override',
  'customer_email_override',
  'customer_address_override',
  'due_date',
  'notes',
  'terms_conditions',
  'discount_amount',
  'discount_percentage',
  'tax_percentage',
  'payment_account_id',
  'payment_account_label',
  'payment_bank_name',
  'payment_account_number',
  'payment_account_name',
] as const

type InvoiceRevisionHeaderFieldValueMap = {
  customer_id: string | null
  customer_name_override: string | null
  customer_phone_override: string | null
  customer_email_override: string | null
  customer_address_override: string | null
  due_date: string | null
  notes: string | null
  terms_conditions: string | null
  discount_amount: number | null
  discount_percentage: number | null
  tax_percentage: number | null
  payment_account_id: string | null
  payment_account_label: string | null
  payment_bank_name: string | null
  payment_account_number: string | null
  payment_account_name: string | null
}

export type InvoiceRevisionHeaderUpdates =
  Partial<InvoiceRevisionHeaderFieldValueMap> &
  Record<string, unknown>

export interface ReviseInvoiceItemInput {
  item_id?: string
  item_type?: 'BASE_SERVICE' | 'ADDON'
  description: string
  quantity: number
  unit_price: number
  service_type?: string | null
  addon_id?: string | null
  order_addon_id?: string | null
  line_order?: number
}

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

type AccessScopedUser = {
  role: UserRole | null
}

async function getAccessScopedUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<AccessScopedUser> {
  const { data: roleRow } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle()

  return {
    role: (roleRow?.role as UserRole | null | undefined) ?? null,
  }
}

export type CreateBlankInvoiceResult =
  | { success: true; data: Invoice }
  | { success: false; error: string }

async function assertCustomerIsVisibleOrThrow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId) {
    return
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('customer_id, created_by')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error || !customer) {
    throw new Error('Customer tidak valid atau tidak dapat diakses')
  }

  const accessUser = await getAccessScopedUser(supabase, userId)
  if (!canAccessCustomer(accessUser, customer)) {
    throw new Error('Customer tidak valid atau tidak dapat diakses')
  }
}

async function assertCustomerExistsForBlankInvoiceOrThrow(
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId) {
    return
  }

  const admin = createAdminClient()
  const { data: customer, error } = await admin
    .from('customers')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error || !customer) {
    throw new Error('Customer tidak valid atau tidak ditemukan')
  }
}

function pickAllowedRevisionUpdates(updates: InvoiceRevisionHeaderUpdates): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedRevisionFieldSet.has(key))
  )
}

function calculateInvoiceTotals(
  subtotal: number,
  adjustments: InvoiceAdjustments
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

  return {
    subtotal: safeSubtotal,
    addons_subtotal: safeSubtotal,
    tax_amount: taxAmount,
    total_amount: taxableBase + taxAmount,
  }
}

async function calculateTotalsFromInvoiceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  adjustments: InvoiceAdjustments
): Promise<InvoiceTotals> {
  const { data: items, error } = await supabase
    .from('invoice_items')
    .select('quantity, unit_price, total_price')
    .eq('invoice_id', invoiceId)

  if (error) {
    logger.error('Error fetching invoice items for totals:', error)
    throw new Error('Gagal menghitung ulang total invoice')
  }

  const subtotal = (items || []).reduce((sum, item) => {
    const totalPrice = item.total_price ?? item.quantity * item.unit_price
    return sum + totalPrice
  }, 0)

  return calculateInvoiceTotals(subtotal, adjustments)
}

function normalizeRevisionItems(
  invoiceId: string,
  items: ReviseInvoiceItemInput[]
): Array<Omit<InvoiceItem, 'item_id' | 'created_at'>> {
  if (items.length === 0) {
    throw new Error('Minimal satu item invoice')
  }

  return items.map((item, index) => {
    const description = item.description?.trim()

    if (!description) {
      throw new Error('Deskripsi item wajib diisi')
    }
    if (!(item.quantity > 0)) {
      throw new Error('Kuantitas item harus lebih dari 0')
    }
    if (item.unit_price < 0) {
      throw new Error('Harga satuan tidak boleh negatif')
    }

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

export interface OrderItemForInvoice {
  serviceType: string
  serviceName: string
  msnCode?: string
  unitTypeName?: string
  capacityLabel?: string
  quantity: number
  estimatedPrice: number
}

/**
 * Get order items with service details for invoice creation
 * Joins service_catalog + unit_types + capacity_ranges for new orders
 * Falls back to service_type text for old orders (backward compatible)
 */
export async function getOrderItemsForInvoice(orderId: string): Promise<OrderItemForInvoice[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      order_item_id,
      service_type,
      quantity,
      estimated_price,
      msn_code,
      catalog_id,
      unit_type_id,
      capacity_id,
      service_catalog (
        catalog_id,
        msn_code,
        service_name,
        base_price
      ),
      unit_types (
        unit_type_id,
        name
      ),
      capacity_ranges (
        capacity_id,
        capacity_label
      )
    `)
    .eq('order_id', orderId)
  
  if (error || !data || data.length === 0) {
    return []
  }
  
  const result: OrderItemForInvoice[] = []

  for (const item of data) {
    const catalog = item.service_catalog as unknown as Record<string, unknown> | null
    const unitType = item.unit_types as unknown as Record<string, unknown> | null
    const capacityRange = item.capacity_ranges as unknown as Record<string, unknown> | null

    if (catalog) {
      // NEW ORDER: Has service_catalog join data
      const displayName = (catalog.service_name as string | undefined) || item.service_type
      const msnCode = (catalog.msn_code as string | undefined) || item.msn_code
      const unitTypeName = unitType?.name as string | undefined
      const capacityLabel = capacityRange?.capacity_label as string | undefined

      result.push({
        serviceType: item.service_type,
        serviceName: displayName,
        msnCode,
        unitTypeName,
        capacityLabel,
        quantity: item.quantity || 1,
        estimatedPrice: item.estimated_price || (catalog.base_price as number | undefined) || 0,
      })
    } else {
      // OLD ORDER: No catalog join, use service_type text as fallback
      // Try to look up from old service_pricing table for backward compat
      const { data: pricing } = await supabase
        .from('service_pricing')
        .select('service_name, base_price')
        .eq('service_type', item.service_type)
        .eq('is_active', true)
        .maybeSingle()
      
      result.push({
        serviceType: item.service_type,
        serviceName: pricing?.service_name || item.service_type,
        quantity: item.quantity || 1,
        estimatedPrice: item.estimated_price || pricing?.base_price || 0,
      })
    }
  }
  
  return result
}

/**
 * Generate unique invoice number
 */
export async function generateInvoiceNumber(): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('generate_invoice_number')

  if (error) {
    logger.error('Error generating invoice number:', error)
    // Fallback to manual generation
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')
    return `INV/${year}/${month}/${random}`
  }

  return data
}

/**
 * Get all invoices with optional filtering
 */
export async function getInvoices(filters?: {
  status?: string
  paymentStatus?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{
  data: Invoice[]
  total: number
  page: number
  limit: number
}> {
  const supabase = await createClient()
  const page = filters?.page || 1
  const limit = filters?.limit || 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('invoices')
    .select(
      `
      *,
      customers (
        customer_id,
        customer_name,
        phone_number,
        email
      ),
      orders (
        order_id,
        order_type,
        status
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  // Note: Computed overdue status handled in post-processing

  if (filters?.status && filters.status !== 'OVERDUE') {
    query = query.eq('status', filters.status)
  }

  if (filters?.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus)
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  if (filters?.dateFrom) {
    query = query.gte('invoice_date', filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte('invoice_date', filters.dateTo)
  }

  if (filters?.search) {
    query = query.or(
      `invoice_number.ilike.%${filters.search}%,customers.customer_name.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    logger.error('Error fetching invoices:', error)
    throw new Error('Gagal memuat data invoice')
  }

  let invoicesWithOverdue: Invoice[] = (data || []).map((invoice): Invoice => {
    const invoiceWithCustomer = withBlankInvoiceCustomer({
      ...invoice,
      source: getInvoiceSource(invoice),
    } as Invoice)

    if (isOverdue(invoiceWithCustomer)) {
      return { ...invoiceWithCustomer, computed_status: 'OVERDUE' as InvoiceStatus }
    }
    return { ...invoiceWithCustomer, computed_status: invoiceWithCustomer.status as InvoiceStatus }
  })

  if (filters?.status === 'OVERDUE') {
    invoicesWithOverdue = invoicesWithOverdue.filter(
      invoice => invoice.computed_status === 'OVERDUE'
    )
  }

  return {
    data: invoicesWithOverdue,
    total: count || 0,
    page,
    limit,
  }
}

/**
 * Get invoice by ID with items and payments
 */
export async function getInvoiceById(invoiceId: string): Promise<{
  invoice: Invoice
  items: InvoiceItem[]
  payments: PaymentRecord[]
  orderItemsDetailed?: Record<string, unknown>[]
} | null> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(
      `
      *,
      customers (
        customer_id,
        customer_name,
        phone_number,
        email,
        billing_address
      ),
      orders (
        order_id,
        order_type,
        status,
        order_date
      )
    `
    )
    .eq('invoice_id', invoiceId)
    .single()

  if (invoiceError) {
    logger.error('Error fetching invoice:', invoiceError)
    return null
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('line_order', { ascending: true })

  const { data: payments, error: paymentsError } = await supabase
    .from('payment_records')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false })

  if (itemsError || paymentsError) {
    logger.error('Error fetching invoice details:', itemsError || paymentsError)
  }

  let invoiceWithOverdue = withBlankInvoiceCustomer({
    ...invoice,
    source: getInvoiceSource(invoice),
  } as Invoice)
  if (isOverdue(invoiceWithOverdue)) {
    invoiceWithOverdue = { ...invoiceWithOverdue, computed_status: 'OVERDUE' }
  } else {
    invoiceWithOverdue = { ...invoiceWithOverdue, computed_status: invoiceWithOverdue.status }
  }

  // Fetch detailed order items with AC unit information
  let orderItemsDetailed = []
  if (invoice.order_id) {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        locations (
          location_id,
          full_address,
          house_number,
          city,
          description
        ),
        ac_units (
          ac_unit_id,
          brand,
          model_number,
          serial_number,
          installation_date
        )
      `)
      .eq('order_id', invoice.order_id)
      .order('location_id')

    if (!orderItemsError && orderItems) {
      orderItemsDetailed = orderItems
    }
  }

  return {
    invoice: invoiceWithOverdue,
    items: items || [],
    payments: payments || [],
    orderItemsDetailed: orderItemsDetailed || [],
  }
}

/**
 * Create new invoice
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber()

  // Calculate totals
  const baseServiceTotal = input.base_service_price
  const addonsSubtotal = input.items
    .filter((item) => item.item_type === 'ADDON')
    .reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const subtotal = baseServiceTotal + addonsSubtotal
  const discountAmount = input.discount_amount || 0
  const discountPercentage = input.discount_percentage || 0
  const taxPercentage = input.tax_percentage || 11 // Use tax from payment account, default 11%
  const taxAmount = ((subtotal - discountAmount) * taxPercentage) / 100
  const totalAmount = subtotal - discountAmount + taxAmount

  // Get invoice config for terms
  const { data: config } = await supabase
    .from('invoice_configuration')
    .select('terms_conditions_template, default_due_days')
    .eq('is_active', true)
    .single()

  // Calculate due date
  const invoiceDate = new Date()
  const dueDate = new Date(
    input.due_date ||
      new Date(invoiceDate.setDate(invoiceDate.getDate() + (config?.default_due_days || 30)))
  )

  await assertCustomerIsVisibleOrThrow(supabase, user!.id, input.customer_id)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_id, customer_id, status')
    .eq('order_id', input.order_id)
    .maybeSingle()

  if (orderError || !order) {
    throw new Error('Order tidak valid atau tidak ditemukan')
  }

  if (order.customer_id !== input.customer_id) {
    throw new Error('Order tidak sesuai dengan customer yang dipilih')
  }

  if (!['DONE', 'COMPLETED'].includes(order.status)) {
    throw new Error('Order belum memenuhi syarat untuk pembuatan invoice')
  }

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      invoice_type: input.invoice_type,
      order_id: input.order_id,
      customer_id: input.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      service_type: input.service_type,
      service_name: input.service_name,
      base_service_quantity: 1,
      base_service_price: input.base_service_price,
      base_service_total: baseServiceTotal,
      addons_subtotal: addonsSubtotal,
      subtotal,
      discount_amount: discountAmount,
      discount_percentage: discountPercentage,
      tax_percentage: taxPercentage,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'DRAFT',
      payment_status: 'UNPAID',
      paid_amount: 0,
      notes: input.notes || null,
      terms_conditions: config?.terms_conditions_template || null,
      payment_account_id: input.payment_account_id || null,
      payment_account_label: input.payment_account_label || null,
      payment_bank_name: input.payment_bank_name || null,
      payment_account_number: input.payment_account_number || null,
      payment_account_name: input.payment_account_name || null,
      created_by: user!.id,
    })
    .select()
    .single()

  if (invoiceError) {
    logger.error('Error creating invoice:', invoiceError)
    throw new Error('Gagal membuat invoice')
  }

  // Create invoice items
  const itemsToInsert = input.items.map((item, index) => ({
    invoice_id: invoice.invoice_id,
    item_type: item.item_type,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
    service_type: item.service_type || null,
    addon_id: item.addon_id || null,
    order_addon_id: item.order_addon_id || null,
    line_order: index,
  }))

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsToInsert)

  if (itemsError) {
    logger.error('Error creating invoice items:', itemsError)
    // Rollback invoice creation
    await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
    throw new Error('Gagal membuat invoice items')
  }

  // Sync order status: DONE → INVOICED (only for FINAL invoices)
  if (input.invoice_type === 'FINAL' && input.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', input.order_id)
      .single()
    
    if (order?.status === 'COMPLETED' || order?.status === 'DONE') {
      await supabase
        .from('orders')
        .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
        .eq('order_id', input.order_id)
    }
  }

  revalidatePath('/dashboard/keuangan/invoices')
  return { ...invoice, source: getInvoiceSource(invoice) }
}

/**
 * Create a blank invoice — an invoice that is NOT linked to an order.
 *
 * Reuses the same numbering function (`generate_invoice_number` RPC), the same
 * invoice-config defaults (terms template, due-day fallback, tax fallback) and
 * the same status defaults (`DRAFT` / `UNPAID`) so the rest of the invoice
 * lifecycle (send, export, payments, status transitions) works unchanged.
 *
 * Differences from createInvoice():
 *   - `order_id` is NULL on the row (and `source = 'BLANK'`).
 *   - Customer info is captured via `customer_*_override` columns when no
 *     `customer_id` is provided.
 *   - `service_type` / `service_name` / `base_service_*` are NULL — blank
 *     invoices have no single "base service"; only line items.
 *
 * Returns the created Invoice (with `source` populated).
 */
function getBlankInvoiceErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Gagal membuat invoice'

  if (message.includes('Unauthorized')) {
    return 'Anda tidak punya akses untuk membuat invoice'
  }

  if (message.includes('Missing Supabase URL or Service Role Key')) {
    return 'Konfigurasi server belum lengkap: SUPABASE_SERVICE_ROLE_KEY belum tersedia.'
  }

  if (message.includes('Customer')) {
    return message
  }

  if (
    message.includes('source') ||
    message.includes('customer_name_override') ||
    message.includes('order_id') ||
    message.includes('service_type') ||
    message.includes('base_service_price') ||
    message.includes('chk_invoices_source_integrity') ||
    message.includes('violates not-null constraint') ||
    message.includes('violates check constraint')
  ) {
    return 'Database belum siap untuk blank invoice. Jalankan migration 012_add_blank_invoice_support.sql di production.'
  }

  if (message.startsWith('Gagal') || message.includes('wajib') || message.includes('valid')) {
    return message
  }

  return 'Gagal membuat invoice. Cek server log untuk detail error.'
}

export async function createBlankInvoice(
  input: CreateBlankInvoiceInput
): Promise<CreateBlankInvoiceResult> {
  try {
    const invoice = await createBlankInvoiceOrThrow(input)
    return { success: true, data: invoice }
  } catch (error) {
    logger.error('createBlankInvoice failed:', error)
    return { success: false, error: getBlankInvoiceErrorMessage(error) }
  }
}

async function createBlankInvoiceOrThrow(
  input: CreateBlankInvoiceInput
): Promise<Invoice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const parsedInput = CreateBlankInvoiceSchema.parse(input)
  const linkedCustomerId = parsedInput.customer_id?.trim() || null
  await assertCustomerExistsForBlankInvoiceOrThrow(linkedCustomerId)

  // Numbering — reuse existing RPC. No order_id needed.
  const invoiceNumber = await generateInvoiceNumber()

  // Pull config for defaults (terms template, due-days fallback, tax fallback)
  const config = await getInvoiceConfig()

  // Resolve dates
  const todayISO = new Date().toISOString().split('T')[0]
  const invoiceDate = parsedInput.invoice_date || todayISO
  const dueDate = parsedInput.due_date

  // Totals — blank invoices have no separate base service; everything is items.
  const subtotal = parsedInput.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )
  const discountAmountInput = parsedInput.discount_amount ?? 0
  const discountPercentage = parsedInput.discount_percentage || 0
  const hasFixedDiscount = discountAmountInput > 0
  const discountAmount = calculateDiscount(
    subtotal,
    hasFixedDiscount ? 'FIXED' : 'PERCENTAGE',
    hasFixedDiscount ? discountAmountInput : discountPercentage
  )
  const taxPercentage =
    parsedInput.tax_percentage ?? config?.default_tax_percentage ?? 11
  const taxableBase = Math.max(0, subtotal - discountAmount)
  const taxAmount = calculateTax(taxableBase, taxPercentage)
  const totalAmount = taxableBase + taxAmount
  const hasLinkedCustomer = Boolean(linkedCustomerId)
  const customerNameOverride = parsedInput.customer_name

  // Build insert payload. Leaves order_id / customer_id / base_service_* NULL
  // when appropriate; relies on migration 012 having loosened NOT NULLs.
  const insertPayload: Record<string, unknown> = {
    invoice_number: invoiceNumber,
    invoice_type: parsedInput.invoice_type,
    source: 'BLANK',
    order_id: null,
    customer_id: linkedCustomerId,

    // Migration constraint compatibility:
    // BLANK invoices must always carry a non-empty customer_name_override,
    // including when customer_id is linked.
    customer_name_override: customerNameOverride,
    // For linked customers, keep non-name overrides nullable and treat the
    // customer FK as source of truth for contact details.
    customer_phone_override: hasLinkedCustomer ? null : parsedInput.customer_phone || null,
    customer_email_override: hasLinkedCustomer ? null : parsedInput.customer_email || null,
    customer_address_override: hasLinkedCustomer ? null : parsedInput.customer_address || null,

    invoice_date: invoiceDate,
    due_date: dueDate,

    // No base service for blank invoices
    service_type: null,
    service_name: null,
    base_service_quantity: 0,
    base_service_price: null,
    base_service_total: null,

    addons_subtotal: subtotal,
    subtotal,
    discount_amount: discountAmount,
    discount_percentage: discountPercentage,
    tax_percentage: taxPercentage,
    tax_amount: taxAmount,
    total_amount: totalAmount,

    status: 'DRAFT',
    payment_status: 'UNPAID',
    paid_amount: 0,

    notes: parsedInput.notes?.trim() || null,
    terms_conditions:
      parsedInput.terms_conditions?.trim() || config?.terms_conditions_template || null,

    payment_account_id: parsedInput.payment_account_id || null,
    payment_account_label: parsedInput.payment_account_label || null,
    payment_bank_name: parsedInput.payment_bank_name || null,
    payment_account_number: parsedInput.payment_account_number || null,
    payment_account_name: parsedInput.payment_account_name || null,

    created_by: user!.id,
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(insertPayload)
    .select()
    .single()

  if (invoiceError || !invoice) {
    logger.error('Error creating blank invoice:', invoiceError)
    throw new Error(invoiceError?.message || 'Gagal membuat invoice')
  }

  // Insert line items
  const itemsToInsert = parsedInput.items.map((item, index) => ({
    invoice_id: invoice.invoice_id,
    item_type: item.item_type || 'BASE_SERVICE',
    description: item.description.trim(),
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
    service_type: null,
    addon_id: null,
    order_addon_id: null,
    line_order: index,
  }))

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsToInsert)

  if (itemsError) {
    logger.error('Error creating blank invoice items:', itemsError)
    // Rollback the invoice header so we don't leave an empty invoice behind.
    await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
    throw new Error(itemsError.message || 'Gagal membuat invoice items')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  return { ...invoice, source: 'BLANK' }
}

/**
 * Update invoice header through the revision-safe field allowlist only.
 * Client-provided immutable/accounting fields (status, payment_status,
 * paid_amount, invoice_number, order_id, source, totals, etc.) are ignored.
 */
export async function updateInvoice(
  invoiceId: string,
  updates: InvoiceRevisionHeaderUpdates
): Promise<Invoice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, order_id, discount_amount, discount_percentage, tax_percentage')
    .eq('invoice_id', invoiceId)
    .single()

  if (fetchError || !currentInvoice) {
    throw new Error('Invoice tidak ditemukan')
  }

  if (!canReviseInvoice(currentInvoice.status)) {
    throw new Error('Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT')
  }

  const safeUpdates = pickAllowedRevisionUpdates(updates)
  await assertCustomerIsVisibleOrThrow(
    supabase,
    user!.id,
    (safeUpdates.customer_id as string | null | undefined) ?? null
  )
  const shouldRecomputeTotals =
    'discount_amount' in safeUpdates ||
    'discount_percentage' in safeUpdates ||
    'tax_percentage' in safeUpdates

  if (shouldRecomputeTotals) {
    Object.assign(
      safeUpdates,
      await calculateTotalsFromInvoiceItems(supabase, invoiceId, {
        discount_amount:
          (safeUpdates.discount_amount as number | null | undefined) ??
          currentInvoice.discount_amount,
        discount_percentage:
          (safeUpdates.discount_percentage as number | null | undefined) ??
          currentInvoice.discount_percentage,
        tax_percentage:
          (safeUpdates.tax_percentage as number | null | undefined) ??
          currentInvoice.tax_percentage,
      })
    )
  }

  if (Object.keys(safeUpdates).length === 0) {
    const { data: unchangedInvoice, error: unchangedError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single()

    if (unchangedError || !unchangedInvoice) {
      throw new Error('Invoice tidak ditemukan')
    }

    return { ...unchangedInvoice, source: getInvoiceSource(unchangedInvoice) }
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .in('status', [...REVISABLE_STATUSES])
    .select()
    .single()

  if (error) {
    logger.error('Error updating invoice:', error)
    throw new Error('Gagal mengupdate invoice')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { ...data, source: getInvoiceSource(data) }
}

/**
 * Replace revision-safe invoice line items and recompute invoice totals from DB data.
 * Uses compensating restore because supabase-js does not expose multi-statement
 * Postgres transactions directly; for full atomicity this should be moved into an RPC.
 */
export async function reviseInvoiceItems(
  invoiceId: string,
  items: ReviseInvoiceItemInput[]
): Promise<Invoice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, discount_amount, discount_percentage, tax_percentage, subtotal, addons_subtotal, tax_amount, total_amount')
    .eq('invoice_id', invoiceId)
    .single()

  if (fetchError || !currentInvoice) {
    throw new Error('Invoice tidak ditemukan')
  }

  if (!canReviseInvoice(currentInvoice.status)) {
    throw new Error('Invoice hanya dapat direvisi saat berstatus DRAFT atau SENT')
  }

  const replacementItems = normalizeRevisionItems(invoiceId, items)

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('line_order', { ascending: true })

  if (existingItemsError) {
    logger.error('Error fetching current invoice items:', existingItemsError)
    throw new Error('Gagal memuat item invoice')
  }

  const restoreItems = (existingItems || []).map(({ item_id: _itemId, created_at: _createdAt, ...item }) => item)
  const previousTotals = {
    subtotal: currentInvoice.subtotal,
    addons_subtotal: currentInvoice.addons_subtotal,
    tax_amount: currentInvoice.tax_amount,
    total_amount: currentInvoice.total_amount,
  }

  const restoreOriginalItems = async (context: string) => {
    const { error: clearError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId)

    if (clearError) {
      logger.error('Failed to clear revised invoice items during restore:', {
        context,
        invoiceId,
        error: clearError,
      })
    }

    if (restoreItems.length === 0) {
      return
    }

    const { error: restoreError } = await supabase
      .from('invoice_items')
      .insert(restoreItems)

    if (restoreError) {
      logger.error('Failed to restore original invoice items:', {
        context,
        invoiceId,
        error: restoreError,
      })
    }
  }

  const { error: deleteError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId)

  if (deleteError) {
    logger.error('Error deleting invoice items for revision:', deleteError)
    throw new Error('Gagal merevisi item invoice')
  }

  const { error: insertError } = await supabase
    .from('invoice_items')
    .insert(replacementItems)

  if (insertError) {
    logger.error('Error inserting revised invoice items:', insertError)
    await restoreOriginalItems('insert_revised_items_failed')
    throw new Error('Gagal menyimpan item invoice')
  }

  const totals = calculateInvoiceTotals(
    replacementItems.reduce((sum, item) => sum + item.total_price, 0),
    currentInvoice
  )

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      ...totals,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .in('status', [...REVISABLE_STATUSES])
    .select()
    .single()

  if (updateError || !updatedInvoice) {
    logger.error('Error updating invoice totals after item revision:', updateError)
    await restoreOriginalItems('update_invoice_totals_failed')
    await supabase
      .from('invoices')
      .update({ ...previousTotals, updated_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId)
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  await updateInvoice(invoiceId, headerUpdates)
  return reviseInvoiceItems(invoiceId, items)
}

/**
 * Delete invoice
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  // Get invoice details first
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, order_id, invoice_type')
    .eq('invoice_id', invoiceId)
    .single()

  if (fetchError || !invoice) {
    throw new Error('Invoice tidak ditemukan')
  }

  // Protection 1: Only allow delete if status is DRAFT
  if (invoice.status !== 'DRAFT') {
    throw new Error(
      `Invoice tidak dapat dihapus karena sudah berstatus ${invoice.status}. ` +
      `Gunakan fitur CANCEL untuk membatalkan invoice yang sudah dikirim.`
    )
  }

  // Protection 2: Check if invoice has payments
  const { data: payments } = await supabase
    .from('payment_records')
    .select('payment_id')
    .eq('invoice_id', invoiceId)
    .limit(1)

  if (payments && payments.length > 0) {
    throw new Error('Invoice tidak dapat dihapus karena sudah memiliki pembayaran')
  }

  // Protection 3: Check if has been sent (communication log)
  const { data: communications } = await supabase
    .from('invoice_communications')
    .select('communication_id')
    .eq('invoice_id', invoiceId)
    .limit(1)

  if (communications && communications.length > 0) {
    throw new Error(
      'Invoice tidak dapat dihapus karena sudah pernah dikirim ke customer. ' +
      'Gunakan fitur CANCEL untuk membatalkan invoice.'
    )
  }

  const { error } = await supabase.from('invoices').delete().eq('invoice_id', invoiceId)

  if (error) {
    logger.error('Error deleting invoice:', error)
    throw new Error('Gagal menghapus invoice')
  }

  // Revert order status: INVOICED → COMPLETED
  if (invoice.order_id && invoice.invoice_type === 'FINAL') {
    await supabase
      .from('orders')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('order_id', invoice.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
}

/**
 * Record payment
 */
export async function recordPayment(
  invoiceId: string,
  payment: {
    payment_date: string
    payment_method: string
    amount: number
    reference_number?: string
    notes?: string
  }
): Promise<PaymentRecord> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  if (payment.amount <= 0) {
    throw new Error('Jumlah pembayaran harus lebih dari 0')
  }

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('total_amount, paid_amount')
    .eq('invoice_id', invoiceId)
    .single()

  if (fetchError) {
    throw new Error('Invoice tidak ditemukan')
  }

  const remaining = invoice.total_amount - (invoice.paid_amount || 0)
  if (payment.amount > remaining) {
    throw new Error(`Jumlah melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')})`)
  }

  // Calculate new paid amount
  const newPaidAmount = invoice.paid_amount + payment.amount

  // Determine new payment status
  let paymentStatus = 'UNPAID'
  let newStatus = 'SENT'
  
  if (newPaidAmount >= invoice.total_amount) {
    paymentStatus = 'PAID'
    newStatus = 'PAID'
  } else if (newPaidAmount > 0) {
    paymentStatus = 'PARTIAL'
    newStatus = 'PARTIAL_PAID'
  }

  // Create payment record
  const { data: paymentRecord, error: paymentError } = await supabase
    .from('payment_records')
    .insert({
      invoice_id: invoiceId,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      amount: payment.amount,
      reference_number: payment.reference_number || null,
      notes: payment.notes || null,
      recorded_by: user!.id,
    })
    .select()
    .single()

  if (paymentError) {
    logger.error('Error recording payment:', paymentError)
    throw new Error('Gagal mencatat pembayaran')
  }

  // Update invoice
  const { data: updatedInvoice } = await supabase
    .from('invoices')
    .update({
      paid_amount: newPaidAmount,
      payment_status: paymentStatus,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .select('order_id, invoice_type')
    .single()

  // Sync order status: If invoice fully paid, update order to PAID
  if (paymentStatus === 'PAID' && updatedInvoice?.order_id && updatedInvoice?.invoice_type === 'FINAL') {
    await supabase
      .from('orders')
      .update({ status: 'PAID', updated_at: new Date().toISOString() })
      .eq('order_id', updatedInvoice.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return paymentRecord
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
): Promise<Invoice> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data, error } = await supabase
    .from('invoices')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .select('*')
    .single()

  if (error) {
    logger.error('Error updating invoice status:', error)
    throw new Error('Gagal mengupdate status invoice')
  }

  // Sync order status: If invoice cancelled, revert order to COMPLETED
  if (status === 'CANCELLED' && data?.order_id && data?.invoice_type === 'FINAL') {
    await supabase
      .from('orders')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('order_id', data.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { ...data, source: getInvoiceSource(data) }
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStats(): Promise<{
  total: number
  draft: number
  sent: number
  partialPaid: number
  paid: number
  overdue: number
  totalRevenue: number
  unpaidAmount: number
}> {
  const supabase = await createClient()

  const [totalResult, draftResult, sentResult, partialPaidResult, paidResult, overdueRowsResult, revenueResult] =
    await Promise.all([
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }),
      supabase
        .from('invoices')
        .select('invoice_id', { count: 'exact', head: true })
        .eq('status', 'DRAFT'),
      supabase
        .from('invoices')
        .select('invoice_id', { count: 'exact', head: true })
        .eq('status', 'SENT'),
      supabase
        .from('invoices')
        .select('invoice_id', { count: 'exact', head: true })
        .eq('status', 'PARTIAL_PAID'),
      supabase
        .from('invoices')
        .select('invoice_id', { count: 'exact', head: true })
        .eq('status', 'PAID'),
      supabase
        .from('invoices')
        .select('due_date, status, payment_status')
        .neq('status', 'PAID')
        .neq('status', 'CANCELLED'),
      supabase.from('invoices').select('total_amount, paid_amount, payment_status'),
    ])

  const overdueCount = overdueRowsResult.data?.filter(isOverdue).length || 0

  const totalRevenue =
    revenueResult.data?.reduce(
      (sum, inv) => (inv.payment_status === 'PAID' ? sum + inv.total_amount : sum),
      0
    ) || 0

  const unpaidAmount =
    revenueResult.data?.reduce(
      (sum, inv) =>
        inv.payment_status !== 'PAID' ? sum + (inv.total_amount - inv.paid_amount) : sum,
      0
    ) || 0

  return {
    total: totalResult.count || 0,
    draft: draftResult.count || 0,
    sent: sentResult.count || 0,
    partialPaid: partialPaidResult.count || 0,
    paid: paidResult.count || 0,
    overdue: overdueCount,
    totalRevenue,
    unpaidAmount,
  }
}

import { ServiceReportMissingError, type CreateInvoiceFromOrderResult } from '@/lib/invoice-errors'

/**
 * Create a PROFORMA invoice from a freshly-created order, using estimated prices.
 *
 * Unlike createInvoiceFromOrder() (which requires the order to be COMPLETED/DONE
 * and pulls actual prices from the service report), this action is meant to run
 * immediately after order creation — so it bypasses the status check and uses the
 * estimated price already captured on order_items.
 *
 * Line items composition:
 *   - One BASE_SERVICE row per order_item, using estimated_price.
 *   - One ADDON row per order_addon (if any).
 */
export async function createProformaInvoice(orderId: string): Promise<{
  success: boolean
  data?: { invoice_id: string; invoice_number: string; total_amount: number }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await requireFinanceRole(user)

    // Fetch order — we do NOT require COMPLETED here; proforma is upfront.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_id, customer_id, status')
      .eq('order_id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return { success: false, error: 'Order tidak ditemukan' }
    }
    if (!order.customer_id) {
      return { success: false, error: 'Order tidak memiliki customer terhubung' }
    }

    // Build base service line items from order_items + service catalog joins
    const orderItems = await getOrderItemsForInvoice(orderId)

    const baseServiceItems: CreateInvoiceInput['items'] = orderItems.map((oi) => ({
      item_type: 'BASE_SERVICE',
      description: [
        oi.serviceName,
        oi.unitTypeName ? `— ${oi.unitTypeName}` : null,
        oi.capacityLabel ? `(${oi.capacityLabel})` : null,
        oi.msnCode ? `· MSN ${oi.msnCode}` : null,
      ]
        .filter(Boolean)
        .join(' '),
      quantity: oi.quantity,
      unit_price: oi.estimatedPrice,
      service_type: oi.serviceType,
    }))

    // Pull any pre-attached order_addons (rare on fresh orders, but supported)
    const { data: orderAddons } = await supabase
      .from('order_addons')
      .select(`
        order_addon_id,
        addon_id,
        quantity,
        unit_price,
        notes,
        addon_catalog ( item_name )
      `)
      .eq('order_id', orderId)

    const addonItems: CreateInvoiceInput['items'] = (orderAddons || []).map((row) => {
      const addonRow = row as unknown as Record<string, unknown>
      const addonCatalog = addonRow.addon_catalog as Record<string, unknown> | null
      const itemName = (addonCatalog?.item_name as string | undefined) ||
        (addonRow.notes as string | undefined) ||
        'Add-on'
      return {
        item_type: 'ADDON',
        description: itemName,
        quantity: Number(addonRow.quantity) || 1,
        unit_price: Number(addonRow.unit_price) || 0,
        addon_id: (addonRow.addon_id as string | undefined) || undefined,
        order_addon_id: (addonRow.order_addon_id as string | undefined) || undefined,
      }
    })

    const items = [...baseServiceItems, ...addonItems]
    if (items.length === 0) {
      return { success: false, error: 'Order tidak memiliki item yang bisa di-invoice' }
    }

    // Header amounts — proforma uses estimated prices, no discount, default tax.
    const baseServiceTotal = baseServiceItems.reduce(
      (sum, it) => sum + it.quantity * it.unit_price,
      0
    )
    const addonsSubtotal = addonItems.reduce(
      (sum, it) => sum + it.quantity * it.unit_price,
      0
    )
    const subtotal = baseServiceTotal + addonsSubtotal
    const config = await getInvoiceConfig()
    const taxPercentage = config?.default_tax_percentage ?? 11
    const taxAmount = (subtotal * taxPercentage) / 100
    const totalAmount = subtotal + taxAmount

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (config?.default_due_days ?? 30))

    const primaryServiceType = orderItems[0]?.serviceType ?? 'PROFORMA'
    const primaryServiceName =
      orderItems.length > 1
        ? 'Multiple Services'
        : orderItems[0]?.serviceName ?? 'Service'

    const invoiceNumber = await generateInvoiceNumber()
    const todayISO = new Date().toISOString().split('T')[0]

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'PROFORMA',
        order_id: orderId,
        customer_id: order.customer_id,
        invoice_date: todayISO,
        due_date: dueDate.toISOString().split('T')[0],
        service_type: primaryServiceType,
        service_name: primaryServiceName,
        base_service_quantity: 1,
        base_service_price: baseServiceTotal,
        base_service_total: baseServiceTotal,
        addons_subtotal: addonsSubtotal,
        subtotal,
        discount_amount: 0,
        discount_percentage: 0,
        tax_percentage: taxPercentage,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: 'DRAFT',
        payment_status: 'UNPAID',
        paid_amount: 0,
        notes: 'Proforma invoice — generated automatically dari order baru.',
        terms_conditions: config?.terms_conditions_template || null,
        created_by: user!.id,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      logger.error('Error creating proforma invoice:', invoiceError)
      return { success: false, error: invoiceError?.message || 'Gagal membuat proforma invoice' }
    }

    const itemsToInsert = items.map((item, index) => ({
      invoice_id: invoice.invoice_id,
      item_type: item.item_type,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      service_type: item.service_type || null,
      addon_id: item.addon_id || null,
      order_addon_id: item.order_addon_id || null,
      line_order: index,
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert)

    if (itemsError) {
      logger.error('Error creating proforma invoice items:', itemsError)
      // Rollback invoice header
      await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id)
      return { success: false, error: itemsError.message || 'Gagal membuat invoice items' }
    }

    revalidatePath('/dashboard/keuangan/invoices')

    return {
      success: true,
      data: {
        invoice_id: invoice.invoice_id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
      },
    }
  } catch (error) {
    logger.error('createProformaInvoice failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membuat proforma invoice',
    }
  }
}


/**
 * Auto-populate a draft invoice from a completed order's service report.
 *
 * Line items are composed from:
 *  - Base service rows (one per order_item) using estimated price.
 *  - Material rows (one per report.materials entry) as ADDON line items.
 *
 * Returns the new invoice's id so the UI can redirect to the detail page
 * for review/edit before sending.
 */
export async function createInvoiceFromOrder(
  orderId: string
): Promise<CreateInvoiceFromOrderResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  // Fetch order and verify state
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_id, customer_id, status')
    .eq('order_id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    throw new Error('Order tidak ditemukan')
  }

  // Accept both COMPLETED (canonical) and DONE (legacy alias)
  const acceptableStatuses = ['COMPLETED', 'DONE']
  if (!acceptableStatuses.includes(order.status)) {
    throw new Error(
      `Order belum siap untuk invoice (status: ${order.status}). ` +
        `Tunggu teknisi submit laporan terlebih dahulu.`
    )
  }

  if (!order.customer_id) {
    throw new Error('Order tidak memiliki customer terhubung')
  }

  // Fetch service report — required for auto-populate
  const report = await getServiceReport(orderId)
  if (!report) {
    throw new ServiceReportMissingError(orderId)
  }

  // Fetch order items (base services per AC unit)
  const orderItems = await getOrderItemsForInvoice(orderId)

  // Build invoice line items
  const baseServiceItems: CreateInvoiceInput['items'] = orderItems.map((oi) => ({
    item_type: 'BASE_SERVICE',
    description: [
      oi.serviceName,
      oi.unitTypeName ? `— ${oi.unitTypeName}` : null,
      oi.capacityLabel ? `(${oi.capacityLabel})` : null,
      oi.msnCode ? `· MSN ${oi.msnCode}` : null,
    ]
      .filter(Boolean)
      .join(' '),
    quantity: oi.quantity,
    unit_price: oi.estimatedPrice,
    service_type: oi.serviceType,
  }))

  const materialItems: CreateInvoiceInput['items'] = report.materials.map((m) => ({
    item_type: 'ADDON',
    description: m.name,
    quantity: m.qty,
    unit_price: m.unit_price,
    addon_id: m.addon_id ?? undefined,
  }))

  const items = [...baseServiceItems, ...materialItems]
  if (items.length === 0) {
    throw new Error('Order tidak memiliki item yang bisa di-invoice')
  }

  // Resolve base service price for invoice header (sum of base lines)
  const baseServicePrice = baseServiceItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  )

  // Resolve invoice config defaults (due date)
  const config = await getInvoiceConfig()
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (config?.default_due_days ?? 30))

  const primaryServiceType = orderItems[0]?.serviceType ?? 'SERVICE'
  const primaryServiceName = orderItems[0]?.serviceName ?? 'Service'

  const invoice = await createInvoice({
    order_id: orderId,
    customer_id: order.customer_id,
    invoice_type: 'FINAL',
    due_date: dueDate.toISOString().split('T')[0],
    service_type: primaryServiceType,
    service_name: primaryServiceName,
    base_service_price: baseServicePrice,
    items,
    notes:
      `Auto-populated dari service report ${report.report_id}.` +
      (report.notes ? `\n\nCatatan teknisi:\n${report.notes}` : ''),
    tax_percentage: config?.default_tax_percentage ?? 11,
  })

  return {
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    source: 'SERVICE_REPORT',
  }
}
