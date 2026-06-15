'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { isOverdue } from '@/lib/invoice-status'
import { getInvoiceSource } from '@/lib/invoice-utils'
import type { Invoice, InvoiceItem, PaymentRecord, OrderItemForInvoice } from './invoices-types'

function withBlankInvoiceCustomer<T extends Invoice>(invoice: T): T {
  if (invoice.customers || invoice.source !== 'BLANK') return invoice
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
    .select(`*, customers (customer_id, customer_name, phone_number, email, billing_address), orders (order_id, order_type, status, order_date)`)
    .eq('invoice_id', invoiceId)
    .single()

  if (invoiceError) {
    logger.error('Error fetching invoice:', invoiceError)
    return null
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('line_order', { ascending: true })

  const { data: payments, error: paymentsError } = await supabase
    .from('payment_records').select('*').eq('invoice_id', invoiceId).order('payment_date', { ascending: false })

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

  let orderItemsDetailed: Record<string, unknown>[] = []
  if (invoice.order_id) {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select(`*, locations (location_id, full_address, house_number, city, description), ac_units (ac_unit_id, brand, model_number, serial_number, installation_date)`)
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
 * Get order items with service details for invoice creation
 */
export async function getOrderItemsForInvoice(orderId: string): Promise<OrderItemForInvoice[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_items')
    .select(`order_item_id, service_type, quantity, estimated_price, msn_code, catalog_id, unit_type_id, capacity_id, service_catalog (catalog_id, msn_code, service_name, base_price), unit_types (unit_type_id, name), capacity_ranges (capacity_id, capacity_label)`)
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
      result.push({
        serviceType: item.service_type,
        serviceName: (catalog.service_name as string | undefined) || item.service_type,
        msnCode: (catalog.msn_code as string | undefined) || item.msn_code,
        unitTypeName: unitType?.name as string | undefined,
        capacityLabel: capacityRange?.capacity_label as string | undefined,
        quantity: item.quantity || 1,
        estimatedPrice: item.estimated_price || (catalog.base_price as number | undefined) || 0,
      })
    } else {
      result.push({
        serviceType: item.service_type,
        serviceName: item.service_type,
        quantity: item.quantity || 1,
        estimatedPrice: item.estimated_price || 0,
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
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `INV/${year}/${month}/${random}`
  }
  return data
}
