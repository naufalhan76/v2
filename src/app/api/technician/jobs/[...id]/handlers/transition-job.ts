import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical, canTransition, type OrderStatus } from '@/lib/order-status'
import { TechnicianTransitionSchema } from '@/app/api/schemas/technician'
import { log, first } from './shared'

function decodeOrderId(segments: string[]) {
  try {
    return { orderId: segments.map(decodeURIComponent).join('/') }
  } catch (error) {
    log.error('Invalid encoded technician job id', { segments, error })
    return { error: jsonError('Invalid encoded order id', 400) }
  }
}

export async function handleTransition(
  request: NextRequest,
  { params, body, authResult }: {
    params: Promise<{ id: string | string[] }>
    body: unknown
    authResult: { technicianId: string; userId: string }
  }
) {
  try {
    const { technicianId, userId } = authResult
    const resolvedParams = await params
    const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]

    const lastSegment = rawId[rawId.length - 1]
    if (lastSegment !== 'transition') {
      return jsonError('Invalid action', 400)
    }
    const idSegments = rawId.slice(0, -1)
    const decoded = decodeOrderId(idSegments)
    if (decoded.error) return decoded.error
    const orderId = decoded.orderId
    const supabase = await createClient()

    const parsed = TechnicianTransitionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 400)
    }

    const { to_status, idempotency_key, gps, arrival_photos } = parsed.data

    if (to_status === 'IN_PROGRESS' && !gps) {
      return jsonError('gps required for Mulai Kerja', 400)
    }

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
        arrival_photos: arrival_photos ?? null,
      })
      .select('to_status')
      .single()

    if (insertError) {
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('duplicate key')
      ) {
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
