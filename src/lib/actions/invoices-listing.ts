'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/utils'
import { isOverdue, type InvoiceStatus } from '@/lib/invoice-status'
import { getInvoiceSource } from '@/lib/invoice-utils'
import type { Invoice } from './invoices-types'

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

export async function getInvoices(filters?: {
  status?: string
  paymentStatus?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ data: Invoice[]; total: number; page: number; limit: number }> {
  const supabase = await createClient()
  const page = filters?.page || 1
  const limit = filters?.limit || 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('invoices')
    .select(
      `*, customers (customer_id, customer_name, phone_number, email), orders (order_id, order_type, status)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters?.status === 'OVERDUE') {
    // ponytail: OVERDUE = SENT + past due_date (narrower than isOverdue which also covers DRAFT/PARTIAL_PAID).
    // Upgrade path: broaden to .in('status', ['SENT','DRAFT','PARTIAL_PAID']) + .neq('payment_status','PAID') if needed.
    const todayIso = new Date().toISOString().split('T')[0]
    query = query.eq('status', 'SENT').lt('due_date', todayIso)
  } else if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.paymentStatus) query = query.eq('payment_status', filters.paymentStatus)
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters?.dateFrom) query = query.gte('invoice_date', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('invoice_date', filters.dateTo)
  if (filters?.search) {
    const sanitized = sanitizeSearchTerm(filters.search)
    query = query.or(
      `invoice_number.ilike.%${sanitized}%,customers.customer_name.ilike.%${sanitized}%`
    )
  }

  const { data, error, count } = await query
  if (error) {
    logger.error('Error fetching invoices:', error)
    throw new Error('Gagal memuat data invoice')
  }

  let invoicesWithOverdue: Invoice[] = (data || []).map((row): Invoice => {
    const withCustomer = withBlankInvoiceCustomer({
      ...row,
      source: getInvoiceSource(row),
    } as Invoice)
    if (isOverdue(withCustomer)) {
      return { ...withCustomer, computed_status: 'OVERDUE' as InvoiceStatus }
    }
    return { ...withCustomer, computed_status: withCustomer.status as InvoiceStatus }
  })

  return { data: invoicesWithOverdue, total: count || 0, page, limit }
}

export async function getInvoiceStats(): Promise<{
  total: number; draft: number; sent: number; partialPaid: number; paid: number; overdue: number; totalRevenue: number; unpaidAmount: number
}> {
  const supabase = await createClient()

  const [totalResult, draftResult, sentResult, partialPaidResult, paidResult, overdueRowsResult, revenueResult] =
    await Promise.all([
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }),
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).eq('status', 'DRAFT'),
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).eq('status', 'SENT'),
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).eq('status', 'PARTIAL_PAID'),
      supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).eq('status', 'PAID'),
      supabase.from('invoices').select('due_date, status, payment_status').neq('status', 'PAID').neq('status', 'CANCELLED'),
      supabase.from('invoices').select('total_amount, paid_amount, payment_status'),
    ])

  const overdueCount = overdueRowsResult.data?.filter(isOverdue).length || 0
  const totalRevenue = revenueResult.data?.reduce((sum, inv) => (inv.payment_status === 'PAID' ? sum + inv.total_amount : sum), 0) || 0
  const unpaidAmount = revenueResult.data?.reduce((sum, inv) => inv.payment_status !== 'PAID' ? sum + (inv.total_amount - inv.paid_amount) : sum, 0) || 0

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
