import { NextRequest } from 'next/server'
import { CompleteServiceSchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'

/**
 * POST /api/service-records/[id]/complete
 * 
 * Mark a service record as completed
 * 
 * Body:
 * {
 *   "descriptionOfWork": "string (optional)",
 *   "cost": number (optional),
 *   "nextServiceDue": ISO datetime string (optional),
 *   "status": "COMPLETED" | "PENDING" (optional)
 * }
 * 
 * Required: Authentication header with Bearer token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const getDuration = measureDuration()
  const method = 'POST'
  const { id: serviceId } = await params
  const path = `/api/service-records/${serviceId}/complete`

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { action: 'complete-service' })

    // Parse request body
    const body = await request.json().catch(() => ({}))

    // Validate input
    const validation = CompleteServiceSchema.safeParse({
      serviceId,
      ...body,
    })

    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const { descriptionOfWork, cost, nextServiceDue, status } = validation.data

    // TODO: Implement service record completion logic
    // For now, return a placeholder response
    const result = {
      success: true,
      data: {
        serviceId,
        status: status || 'COMPLETED',
        completedAt: new Date().toISOString(),
      },
    }

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, 'Failed to complete service')
      return jsonError('Failed to complete service', 400)
    }

    // Log audit trail
    await createAuditLog(user.id, 'COMPLETE_SERVICE', 'service_records', serviceId, {
      descriptionOfWork,
      cost,
      nextServiceDue,
      status,
    })

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
