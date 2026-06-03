import { NextRequest } from 'next/server'
import { updateOrderStatus } from '@/lib/actions/orders'
import { UpdateOrderStatusSchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'
import { createClient } from '@/lib/supabase-server'
import type { TransitionRole } from '@/lib/order-status'

/**
 * POST /api/orders/[id]/status
 * 
 * Update order status with validation
 * 
 * Body:
 * {
 *   "newStatus": "ACCEPTED" | "ASSIGNED" | "OTW" | etc.
 * }
 * 
 * Status transition rules are enforced here
 * Required: Authentication header with Bearer token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const getDuration = measureDuration()
  const method = 'POST'
  const { id: orderId } = await params
  const path = `/api/orders/${orderId}/status`

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { action: 'update-status' })

    // Parse request body
    const body = await request.json().catch(() => ({}))

    // Validate input
    const validation = UpdateOrderStatusSchema.safeParse({
      orderId,
      newStatus: body.newStatus,
      req_visit_date: body.req_visit_date,
    })

    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const { newStatus, req_visit_date } = validation.data

    // Fetch caller's role to validate status transition rules
    const supabase = await createClient()
    const { data: userMgmt } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const role = userMgmt?.role as TransitionRole | undefined
    if (!role) {
      return jsonError('Role pengguna tidak ditemukan', 403)
    }
    
    // Call server action to update status (use admin client for API routes but validate role transition)
    const result = await updateOrderStatus(orderId, newStatus, undefined, req_visit_date, true, role)

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to update order status', 400)
    }

    // Log audit trail
    await createAuditLog(user.id, 'UPDATE_STATUS', 'orders', orderId, {
      newStatus,
      timestamp: new Date().toISOString(),
    })

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
