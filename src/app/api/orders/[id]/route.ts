import { NextRequest } from 'next/server'
import { z } from 'zod'
import { cancelOrder, assignOrdersToTechnician, rescheduleOrder, updateOrderStatus } from '@/lib/actions/orders'
import type { TransitionRole } from '@/lib/order-status'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/orders/[id]
 *
 * Unified order mutation endpoint. Dispatches to the appropriate server action
 * based on the combination of fields in the request body.
 *
 * Dispatch rules:
 *   status=CANCELLED                          → cancelOrder
 *   status=ASSIGNED + assigned_technician_id  → assignOrdersToTechnician
 *   status=PENDING  + scheduled_visit_date    → rescheduleOrder
 *   status=<other>                            → updateOrderStatus
 *
 * RBAC:
 *   TECHNICIAN  — 403 (blocked entirely)
 *   FINANCE     — may only set status=INVOICED or PAID
 *   ADMIN / SUPERADMIN — all operations
 *
 * Auth: Bearer token (Authorization header) or cookie session.
 */

const log = logger.child('orders-patch')

const PatchOrderSchema = z.object({
  status: z
    .enum(['ASSIGNED', 'CANCELLED', 'PENDING', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID'])
    .optional(),
  assigned_technician_id: z.string().optional().nullable(),
  scheduled_visit_date: z.string().optional().nullable(),
  req_visit_date: z.string().optional().nullable(),
  cancellation_reason: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const getDuration = measureDuration()
  const method = 'PATCH'
  const { id: orderId } = await params
  const path = `/api/orders/${orderId}`

  try {
    // 1. Auth — Bearer token first, fall back to cookie session so browser
    //    clients (and Playwright page.request) work without an explicit header.
    let user = await requireAuth(request)
    if (!user) {
      try {
        const supabase = await createClient()
        const {
          data: { user: sessionUser },
        } = await supabase.auth.getUser()
        user = sessionUser ?? null
      } catch (err) {
        log.error('cookie session fallback failed', err)
      }
    }
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { action: 'patch' })

    // 2. Role — read from user_management; block TECHNICIAN
    const supabase = await createClient()
    const { data: userMgmt } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const role = userMgmt?.role ?? null
    if (!role || role === 'TECHNICIAN') {
      return jsonError('Forbidden: Insufficient permissions', 403)
    }

    // 3. Parse + validate body
    const body = await request.json().catch(() => ({}))
    const validation = PatchOrderSchema.safeParse(body)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const data = validation.data

    // 4. Finance RBAC — may only advance to INVOICED or PAID
    if (role === 'FINANCE' && data.status && !['INVOICED', 'PAID'].includes(data.status)) {
      return jsonError('Forbidden: Finance role can only set status to INVOICED or PAID', 403)
    }

    // 5. Dispatch to the appropriate server action
    let result: { success: boolean; data?: unknown; error?: string; message?: string }

    if (data.status === 'CANCELLED') {
      result = await cancelOrder(orderId, data.cancellation_reason)
    } else if (data.status === 'ASSIGNED' && data.assigned_technician_id) {
      result = await assignOrdersToTechnician({
        orderIds: [orderId],
        technicianId: data.assigned_technician_id,
        scheduledDate: data.scheduled_visit_date ?? new Date().toISOString().slice(0, 10),
      })
    } else if (data.status === 'PENDING' && data.scheduled_visit_date) {
      result = await rescheduleOrder({
        orderId,
        reason: data.cancellation_reason ?? 'Rescheduled via API',
        newScheduledDate: data.scheduled_visit_date,
      })
    } else if (data.status) {
      result = await updateOrderStatus(
        orderId,
        data.status,
        undefined,
        data.req_visit_date ?? undefined,
        true, // useAdminClient — bypass RLS for API route callers
        role as TransitionRole,
      )
    } else {
      return jsonError('No actionable fields provided', 400)
    }

    const duration = getDuration()

    if (!result.success) {
      const errMsg = result.error ?? 'Operation failed'
      // Concurrent modification detected by the action layer
      if (errMsg.toLowerCase().includes('concurrently')) {
        logResponse(logRequest(method, path, user.id), 409, duration, errMsg)
        return jsonError(errMsg, 409)
      }
      // State machine violation or other business rule failure
      logResponse(logRequest(method, path, user.id), 422, duration, errMsg)
      return jsonError(errMsg, 422)
    }

    await createAuditLog(user.id, 'PATCH', 'orders', orderId, {
      status: data.status,
      assigned_technician_id: data.assigned_technician_id,
      scheduled_visit_date: data.scheduled_visit_date,
    })

    logResponse(logRequest(method, path, user.id), 200, duration)
    return jsonSuccess(result.data ?? { orderId }, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
