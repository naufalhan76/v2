'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface Invoice {
  invoice_id: string
  invoice_number: string
  invoice_type: 'PROFORMA' | 'FINAL'
  order_id: string
  customer_id: string
  invoice_date: string
  due_date: string
  service_type: string
  service_name: string
  base_service_quantity: number
  base_service_price: number
  base_service_total: number
  addons_subtotal: number
  subtotal: number
  discount_amount: number
  discount_percentage: number
  tax_percentage: number
  tax_amount: number
  total_amount: number
  status: 'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
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
    const catalog = item.service_catalog as any
    const unitType = item.unit_types as any
    const capacityRange = item.capacity_ranges as any

    if (catalog) {
      // NEW ORDER: Has service_catalog join data
      const displayName = catalog.service_name || item.service_type
      const msnCode = catalog.msn_code || item.msn_code
      const unitTypeName = unitType?.name
      const capacityLabel = capacityRange?.capacity_label
      
      result.push({
        serviceType: item.service_type,
        serviceName: displayName,
        msnCode,
        unitTypeName,
        capacityLabel,
        quantity: item.quantity || 1,
        estimatedPrice: item.estimated_price || catalog.base_price || 0,
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
    console.error('Error generating invoice number:', error)
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

  if (filters?.status) {
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
    console.error('Error fetching invoices:', error)
    throw new Error('Gagal memuat data invoice')
  }

  // Compute overdue status for display
  const today = new Date().toISOString().split('T')[0]
  const invoicesWithOverdue = (data || []).map(invoice => {
    // Auto-compute OVERDUE: due_date passed AND not paid/cancelled
    if (
      invoice.due_date < today &&
      invoice.status !== 'PAID' &&
      invoice.status !== 'CANCELLED' &&
      invoice.payment_status !== 'PAID'
    ) {
      return { ...invoice, computed_status: 'OVERDUE' }
    }
    return { ...invoice, computed_status: invoice.status }
  })

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
  orderItemsDetailed?: any[]
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
    console.error('Error fetching invoice:', invoiceError)
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
    console.error('Error fetching invoice details:', itemsError || paymentsError)
  }

  // Compute overdue status for display
  const today = new Date().toISOString().split('T')[0]
  let invoiceWithOverdue = invoice
  if (
    invoice.due_date < today &&
    invoice.status !== 'PAID' &&
    invoice.status !== 'CANCELLED' &&
    invoice.payment_status !== 'PAID'
  ) {
    invoiceWithOverdue = { ...invoice, computed_status: 'OVERDUE' }
  } else {
    invoiceWithOverdue = { ...invoice, computed_status: invoice.status }
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

  if (!user) {
    throw new Error('Unauthorized')
  }

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
      created_by: user.id,
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
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
    console.error('Error creating invoice items:', itemsError)
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
    
    if (order?.status === 'DONE') {
      await supabase
        .from('orders')
        .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
        .eq('order_id', input.order_id)
    }
  }

  revalidatePath('/dashboard/keuangan/invoices')
  return invoice
}

/**
 * Update invoice
 */
export async function updateInvoice(
  invoiceId: string,
  updates: Partial<CreateInvoiceInput> & {
    status?: string
    notes?: string
    terms_conditions?: string
  }
): Promise<Invoice> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice:', error)
    throw new Error('Gagal mengupdate invoice')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return data
}

/**
 * Delete invoice
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()

  // Get invoice details first
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, payment_status, paid_amount, invoice_number')
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

  // Get invoice details for order sync
  const { data: invoiceDetails } = await supabase
    .from('invoices')
    .select('order_id, invoice_type')
    .eq('invoice_id', invoiceId)
    .single()

  const { error } = await supabase.from('invoices').delete().eq('invoice_id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    throw new Error('Gagal menghapus invoice')
  }

  // Revert order status: INVOICED → DONE
  if (invoiceDetails?.order_id && invoiceDetails?.invoice_type === 'FINAL') {
    await supabase
      .from('orders')
      .update({ status: 'DONE', updated_at: new Date().toISOString() })
      .eq('order_id', invoiceDetails.order_id)
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

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('total_amount, paid_amount')
    .eq('invoice_id', invoiceId)
    .single()

  if (fetchError) {
    throw new Error('Invoice tidak ditemukan')
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
      recorded_by: user.id,
    })
    .select()
    .single()

  if (paymentError) {
    console.error('Error recording payment:', paymentError)
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
    console.error('Error updating invoice status:', error)
    throw new Error('Gagal mengupdate status invoice')
  }

  // Sync order status: If invoice cancelled, revert order to DONE
  if (status === 'CANCELLED' && data?.order_id && data?.invoice_type === 'FINAL') {
    await supabase
      .from('orders')
      .update({ status: 'DONE', updated_at: new Date().toISOString() })
      .eq('order_id', data.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return data
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

  const [totalResult, draftResult, sentResult, partialPaidResult, paidResult, overdueResult, revenueResult] =
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
        .select('invoice_id', { count: 'exact', head: true })
        .eq('status', 'OVERDUE'),
      supabase.from('invoices').select('total_amount, paid_amount, payment_status'),
    ])

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
    overdue: overdueResult.count || 0,
    totalRevenue,
    unpaidAmount,
  }
}
