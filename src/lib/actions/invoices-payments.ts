'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { requireFinanceRole } from '@/lib/rbac'
import { getInvoiceSource } from '@/lib/invoice-utils'
import type { Invoice, PaymentRecord } from './invoices-types'

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
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  if (payment.amount <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0')

  const idempotencyKey = crypto.randomUUID()

  const { data: result, error: rpcError } = await supabase.rpc('record_payment_v2', {
    p_invoice_id: invoiceId,
    p_amount: payment.amount,
    p_payment_method: payment.payment_method,
    p_payment_date: payment.payment_date,
    p_reference_number: payment.reference_number || null,
    p_notes: payment.notes || null,
    p_recorded_by: user!.id,
    p_idempotency_key: idempotencyKey,
  })

  if (rpcError) {
    logger.error('Error recording payment via RPC:', rpcError)
    throw new Error(rpcError.message || 'Gagal mencatat pembayaran')
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { payment_id: result.payment_id, ...payment, recorded_by: user!.id } as PaymentRecord
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices').select('status, order_id, invoice_type').eq('invoice_id', invoiceId).single()
  if (fetchError || !invoice) throw new Error('Invoice tidak ditemukan')

  if (invoice.status !== 'DRAFT') {
    throw new Error(
      `Invoice tidak dapat dihapus karena sudah berstatus ${invoice.status}. ` +
      `Gunakan fitur CANCEL untuk membatalkan invoice yang sudah dikirim.`
    )
  }

  const { data: payments } = await supabase
    .from('payment_records').select('payment_id').eq('invoice_id', invoiceId).limit(1)
  if (payments && payments.length > 0) {
    throw new Error('Invoice tidak dapat dihapus karena sudah memiliki pembayaran')
  }

  const { data: communications } = await supabase
    .from('invoice_communications').select('communication_id').eq('invoice_id', invoiceId).limit(1)
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

  if (invoice.order_id && invoice.invoice_type === 'FINAL') {
    await supabase
      .from('orders').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('order_id', invoice.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'DRAFT' | 'SENT' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
): Promise<Invoice> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['SENT', 'CANCELLED'],
    SENT: ['PARTIAL_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
    PARTIAL_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],
    PAID: [], // terminal
    OVERDUE: ['PAID', 'CANCELLED'],
    CANCELLED: [], // terminal
  }

  // Fetch current invoice before update
  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices').select('status, total_amount').eq('invoice_id', invoiceId).single()
  if (fetchError || !currentInvoice) {
    logger.error('Error fetching current invoice:', fetchError)
    throw new Error('Invoice tidak ditemukan')
  }

  const currentStatus = currentInvoice.status
  const allowed = allowedTransitions[currentStatus] || []
  if (!allowed.includes(status)) {
    throw new Error(`Transisi status dari ${currentStatus} ke ${status} tidak diizinkan`)
  }

  // Build update payload based on status
  const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }

  if (status === 'PAID') {
    updatePayload.payment_status = 'PAID'
    updatePayload.paid_amount = currentInvoice.total_amount
  } else if (status === 'CANCELLED') {
    updatePayload.payment_status = 'CANCELLED'
  }

  const { data, error } = await supabase
    .from('invoices').update(updatePayload).eq('invoice_id', invoiceId).select('*').single()
  if (error) {
    logger.error('Error updating invoice status:', error)
    throw new Error('Gagal mengupdate status invoice')
  }

  if (status === 'CANCELLED' && data?.order_id && data?.invoice_type === 'FINAL') {
    await supabase
      .from('orders').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('order_id', data.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return { ...data, source: getInvoiceSource(data) }
}
