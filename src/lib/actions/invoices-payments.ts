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

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices').select('total_amount, paid_amount, status').eq('invoice_id', invoiceId).single()
  if (fetchError) throw new Error('Invoice tidak ditemukan')

  if (!invoice.status || invoice.status === 'DRAFT') {
    throw new Error('Invoice masih dalam status DRAFT. Kirim invoice terlebih dahulu sebelum mencatat pembayaran.')
  }
  if (invoice.status === 'CANCELLED') {
    throw new Error('Tidak bisa mencatat pembayaran untuk invoice yang sudah dibatalkan.')
  }

  const remaining = invoice.total_amount - (invoice.paid_amount || 0)
  if (payment.amount > remaining) {
    throw new Error(`Jumlah melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')})`)
  }

  const newPaidAmount = invoice.paid_amount + payment.amount

  let paymentStatus = 'UNPAID'
  let newStatus = 'SENT'
  if (newPaidAmount >= invoice.total_amount) {
    paymentStatus = 'PAID'
    newStatus = 'PAID'
  } else if (newPaidAmount > 0) {
    paymentStatus = 'PARTIAL_PAID'
    newStatus = 'PARTIAL_PAID'
  }

  const { data: paymentRecord, error: paymentError } = await supabase
    .from('payment_records').insert({
      invoice_id: invoiceId,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      amount: payment.amount,
      reference_number: payment.reference_number || null,
      notes: payment.notes || null,
      recorded_by: user!.id,
    }).select().single()

  if (paymentError) {
    logger.error('Error recording payment:', paymentError)
    throw new Error('Gagal mencatat pembayaran')
  }

  const { data: updatedInvoice } = await supabase
    .from('invoices').update({
      paid_amount: newPaidAmount,
      payment_status: paymentStatus,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('invoice_id', invoiceId).select('order_id, invoice_type').single()

  if (paymentStatus === 'PAID' && updatedInvoice?.order_id && updatedInvoice?.invoice_type === 'FINAL') {
    await supabase
      .from('orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('order_id', updatedInvoice.order_id)
  }

  revalidatePath('/dashboard/keuangan/invoices')
  revalidatePath(`/dashboard/keuangan/invoices/${invoiceId}`)
  return paymentRecord
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
