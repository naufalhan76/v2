import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical } from '@/lib/order-status'
import { TechnicianReportSchema } from '@/app/api/schemas/technician'
import { computeWorkDurationMinutes } from '@/lib/offline/time'
import { log, isKnownRpcValidationError } from './shared'

function decodeOrderId(segments: string[]) {
  try {
    return { orderId: segments.map(decodeURIComponent).join('/') }
  } catch (error) {
    log.error('Invalid encoded technician job id', { segments, error })
    return { error: jsonError('Invalid encoded order id', 400) }
  }
}

export async function handleSubmitReport(
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
    if (lastSegment !== 'report') {
      return jsonError('Invalid action', 400)
    }
    const idSegments = rawId.slice(0, -1)
    const decoded = decodeOrderId(idSegments)
    if (decoded.error) return decoded.error
    const orderId = decoded.orderId
    const supabase = await createClient()

    const parsed = TechnicianReportSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 422)
    }

    const payload = parsed.data
    const rpcPayload =
      payload.work_started_at && payload.work_completed_at
        ? {
            ...payload,
            work_duration_minutes: computeWorkDurationMinutes(
              payload.work_started_at,
              payload.work_completed_at
            ),
          }
        : payload

    const { data: assignment, error: assignError } = await supabase
      .from('order_technicians')
      .select('role')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .eq('role', 'lead')
      .is('removed_at', null)
      .maybeSingle()

    if (assignError) throw assignError
    if (!assignment) {
      return jsonError('Not assigned as lead technician for this order', 403)
    }

    const { data: existingReport } = await supabase
      .from('service_reports')
      .select('report_id')
      .eq('order_id', orderId)
      .eq('idempotency_key', payload.idempotency_key)
      .maybeSingle()

    if (existingReport) {
      return jsonSuccess({
        report_id: existingReport.report_id,
        idempotent_replay: true,
      })
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
    if (currentCanonical === 'COMPLETED' || currentCanonical === 'INVOICED' || currentCanonical === 'PAID') {
      const { data: completedReport } = await supabase
        .from('service_reports')
        .select('report_id')
        .eq('order_id', orderId)
        .maybeSingle()

      if (completedReport) {
        return jsonSuccess({
           report_id: completedReport.report_id,
           idempotent_replay: true,
           message: 'Order already completed and reported'
        })
      }
    }

    if (currentCanonical !== 'IN_PROGRESS') {
      return jsonError(`Cannot submit report when order is ${currentCanonical}`, 422)
    }

    const { data: result, error: rpcError } = await supabase.rpc('technician_submit_report_v2', {
      p_order_id: orderId,
      p_technician_id: technicianId,
      p_payload: rpcPayload,
      p_work_duration_minutes: rpcPayload.work_duration_minutes ?? null,
    })

    if (rpcError) {
      if (rpcError.code === '23505' || rpcError.message?.includes('duplicate key')) {
        const { data: racedReport } = await supabase
          .from('service_reports')
          .select('report_id')
          .eq('order_id', orderId)
          .eq('idempotency_key', payload.idempotency_key)
          .maybeSingle()

        return jsonSuccess({
          report_id: racedReport?.report_id,
          idempotent_replay: true,
        })
      }

      if (isKnownRpcValidationError(rpcError)) {
        return jsonError(rpcError.message, 422)
      }

      log.error('Unexpected technician report RPC error', {
        orderId,
        technicianId,
        code: rpcError.code,
        message: rpcError.message,
      })
      throw rpcError
    }

    return jsonSuccess({
      report_id: result,
      status: 'COMPLETED'
    })
  } catch (error) {
    return handleApiError(error)
  }
}
