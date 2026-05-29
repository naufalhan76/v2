import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical, canTransition, type OrderStatus } from '@/lib/order-status'
import { TechnicianTransitionSchema } from '@/app/api/schemas/technician'

/**
 * POST /api/technician/jobs/[id]/transition
 *
 * Transition an order to the next status.
 * Technician can only: ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> COMPLETED.
 *
 * Optional GPS coordinates are recorded on `order_status_transitions` purely
 * for audit. A missing or denied location never blocks the transition.
 *
 * `idempotency_key` (UUID) is the offline retry handle. If a row with the
 * same (order_id, idempotency_key) already exists we treat the request as a
 * successful no-op so flaky-network retries can't double-transition.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId, userId } = authResult
    const { id: orderId } = await params
    const body = await request.json()

    const parsed = TechnicianTransitionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 400)
    }

    const { to_status, idempotency_key, gps } = parsed.data
    const supabase = await createClient()

    // P1 fix: lead-assignment check moved ABOVE idempotency check so only the
    // assigned lead can probe (order_id, idempotency_key) pairs — per oracle review
    const { data: assignment, error: assignError } = await supabase
      .from('order_technicians')
      .select('role')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .eq('role', 'lead')
      .maybeSingle()

    if (assignError) throw assignError
    if (!assignment) {
      return jsonError('Not assigned as lead technician for this order', 403)
    }

    // Idempotency check — return current status if we've already processed
    // this exact request from a queued offline retry.
    if (idempotency_key) {
      const { data: existing } = await supabase
        .from('order_status_transitions')
        .select('to_status')
        .eq('order_id', orderId)
        .eq('idempotency_key', idempotency_key)
        .maybeSingle()

      if (existing) {
        return jsonSuccess({
          order_id: orderId,
          new_status: existing.to_status,
          idempotent_replay: true,
        })
      }
    }

    // Read current order status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()

    if (orderError) throw orderError
    if (!order) {
      return jsonError('Order not found', 404)
    }

    const currentCanonical = toCanonical(order.status)

    // If the order is already at-or-past the requested status, treat as a
    // successful idempotent replay (offline queue scenario).
    if (currentCanonical === to_status) {
      return jsonSuccess({
        order_id: orderId,
        previous_status: currentCanonical,
        new_status: to_status,
        idempotent_replay: true,
      })
    }

    if (!canTransition(order.status, to_status as OrderStatus, 'TECHNICIAN')) {
      return jsonError(
        `Invalid transition: cannot move from ${currentCanonical} to ${to_status}`,
        422
      )
    }

    // Apply transition
    // P1 fix: optimistic lock — TOCTOU per oracle F2
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({
        status: to_status,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('status', order.status)
      .select('status')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updated) {
      return jsonError('Order status changed concurrently. Refresh and retry.', 409)
    }

    // Audit log with optional GPS payload.
    // P1 fix: catch unique constraint violation (23505) on idempotency_key so
    // concurrent retries get an idempotent 200 instead of a 500 — per oracle review
    const { data: insertedTransition, error: insertError } = await supabase
      .from('order_status_transitions')
      .insert({
        order_id: orderId,
        from_status: order.status,
        to_status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        notes: `Technician transition: ${currentCanonical} → ${to_status}`,
        idempotency_key: idempotency_key ?? null,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
        accuracy_m: gps?.accuracy_m ?? null,
        captured_at: gps?.captured_at ?? null,
        gps_error: gps?.gps_error ?? null,
      })
      .select('to_status')
      .single()

    if (insertError) {
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('duplicate key')
      ) {
        // Race: a concurrent request already committed this transition row.
        // Fetch the winning row and return it as an idempotent replay.
        const { data: racedRow } = await supabase
          .from('order_status_transitions')
          .select('to_status')
          .eq('order_id', orderId)
          .eq('idempotency_key', idempotency_key)
          .maybeSingle()

        return jsonSuccess({
          order_id: orderId,
          new_status: racedRow?.to_status ?? to_status,
          idempotent_replay: true,
        })
      }
      throw insertError
    }

    return jsonSuccess({
      order_id: orderId,
      previous_status: currentCanonical,
      new_status: insertedTransition?.to_status ?? to_status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
