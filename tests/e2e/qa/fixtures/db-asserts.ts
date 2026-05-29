/**
 * Read-only DB assertion helpers for the QA suite. Returns typed snapshots
 * so specs can `expect(snapshot.invoices[0].paymentStatus).toBe('PAID')`.
 */

import { getSupabaseAdmin } from './env'
import type {
  FullOrderSnapshot,
  InvoiceSnapshot,
  ServiceReportSnapshot,
  StatusTransitionSnapshot,
} from './types'
import type { OrderStatus } from '@/lib/order-status'

export async function getFullOrderSnapshot(
  orderId: string
): Promise<FullOrderSnapshot> {
  const supabase = getSupabaseAdmin()

  const { data: order } = await supabase
    .from('orders')
    .select('order_id, status, updated_at')
    .eq('order_id', orderId)
    .maybeSingle()

  const { data: transitionsRaw } = await supabase
    .from('order_status_transitions')
    .select(
      'transition_id, from_status, to_status, notes, idempotency_key, lat, lng, gps_error, transition_date'
    )
    .eq('order_id', orderId)
    .order('transition_date', { ascending: true })

  const { data: reportsRaw } = await supabase
    .from('service_reports')
    .select(
      'report_id, order_id, technician_id, photos_before, photos_after, ac_units, materials, actual_total_price, customer_signature_url, customer_name_signed, next_service_recommendation_date, idempotency_key'
    )
    .eq('order_id', orderId)
    .is('deleted_at', null)

  const { data: invoicesRaw } = await supabase
    .from('invoices')
    .select(
      'invoice_id, invoice_type, status, payment_status, total_amount, paid_amount'
    )
    .eq('order_id', orderId)

  const invoiceIds = (invoicesRaw ?? []).map((i) => i.invoice_id)
  const { data: paymentsRaw } =
    invoiceIds.length > 0
      ? await supabase
          .from('payment_records')
          .select('payment_id, amount, payment_method')
          .in('invoice_id', invoiceIds)
      : { data: [] }

  return {
    order: {
      orderId: order?.order_id ?? orderId,
      status: (order?.status ?? 'PENDING') as OrderStatus,
      updatedAt: order?.updated_at ?? '',
    },
    transitions: (transitionsRaw ?? []).map(
      (t): StatusTransitionSnapshot => ({
        transitionId: t.transition_id,
        fromStatus: t.from_status,
        toStatus: t.to_status,
        notes: t.notes,
        idempotencyKey: t.idempotency_key,
        lat: t.lat,
        lng: t.lng,
        gpsError: t.gps_error,
        transitionDate: t.transition_date,
      })
    ),
    reports: (reportsRaw ?? []).map(
      (r): ServiceReportSnapshot => ({
        reportId: r.report_id,
        orderId: r.order_id,
        technicianId: r.technician_id,
        photosBefore: r.photos_before ?? [],
        photosAfter: r.photos_after ?? [],
        acUnits: r.ac_units ?? [],
        actualTotalPrice: Number(r.actual_total_price ?? 0),
        customerSignatureUrl: r.customer_signature_url,
        customerNameSigned: r.customer_name_signed,
        nextServiceRecommendationDate: r.next_service_recommendation_date,
        idempotencyKey: r.idempotency_key,
      })
    ),
    invoices: (invoicesRaw ?? []).map(
      (i): InvoiceSnapshot => ({
        invoiceId: i.invoice_id,
        invoiceType: i.invoice_type,
        status: i.status,
        paymentStatus: i.payment_status,
        totalAmount: Number(i.total_amount ?? 0),
        paidAmount: Number(i.paid_amount ?? 0),
      })
    ),
    payments: (paymentsRaw ?? []).map((p) => ({
      paymentId: p.payment_id,
      amount: Number(p.amount ?? 0),
      method: p.payment_method,
    })),
  }
}

export async function getOrderStatus(orderId: string): Promise<OrderStatus> {
  const snapshot = await getFullOrderSnapshot(orderId)
  return snapshot.order.status
}

export async function getReminderCount(acUnitId: string): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count } = await supabase
    .from('customer_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('ac_unit_id', acUnitId)
  return count ?? 0
}
