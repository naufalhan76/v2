import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical, canTransition, type OrderStatus } from '@/lib/order-status'
import { z } from 'zod'

const transitionSchema = z.object({
  to_status: z.enum(['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']),
})

/**
 * POST /api/technician/jobs/[id]/transition
 * Transition an order to the next status.
 * Technician can only: ASSIGNED->EN_ROUTE, EN_ROUTE->IN_PROGRESS, IN_PROGRESS->COMPLETED
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

    // Validate input
    const parsed = transitionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 400)
    }

    const { to_status } = parsed.data
    const supabase = await createClient()

    // Verify assignment
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

    // Get current order status
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

    // Validate transition
    if (!canTransition(order.status, to_status as OrderStatus, 'TECHNICIAN')) {
      return jsonError(
        `Invalid transition: cannot move from ${currentCanonical} to ${to_status}`,
        422
      )
    }

    // Perform the transition
    const updateData: Record<string, unknown> = {
      status: to_status,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_id', orderId)

    if (updateError) throw updateError

    // Log the transition in order_status_transitions
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: order.status,
      to_status: to_status,
      changed_by: userId,
      changed_at: new Date().toISOString(),
      notes: `Technician transition: ${currentCanonical} → ${to_status}`,
    })

    return jsonSuccess({
      order_id: orderId,
      previous_status: currentCanonical,
      new_status: to_status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
