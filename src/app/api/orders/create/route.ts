import { NextRequest } from 'next/server'
import { createOrder } from '@/lib/actions/orders'
import { CreateOrderSchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'
import { normalizeOrderServiceType } from '@/lib/service-types'

/**
 * POST /api/orders
 * 
 * Create a new order
 * 
 * Body:
 * {
 *   "customerId": "uuid",
 *   "locationId": "uuid",
 *   "orderType": "string",
 *   "description": "string (optional)",
 *   "items": [
 *     {
 *       "serviceType": "string",
 *       "quantity": number (optional),
 *       "estimatedPrice": number (optional)
 *     }
 *   ]
 * }
 * 
 * Required: Authentication header with Bearer token
 */
export async function POST(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'POST'
  const path = '/api/orders'

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { action: 'create' })

    // Parse request body
    const body = await request.json().catch(() => ({}))

    // Validate input
    const validation = CreateOrderSchema.safeParse(body)

    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const { customerId, locationId, orderType, description, items } = validation.data

    // Create order using server action
    const result = await createOrder({
      customer_id: customerId,
      location_id: locationId,
      order_type: normalizeOrderServiceType(orderType),
      priority: 'NORMAL',
      description,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to create order', 400)
    }

    // Log audit trail
    await createAuditLog(user.id, 'CREATE', 'orders', result.data?.orderId || '', {
      customerId,
      locationId,
      orderType,
      itemCount: items?.length || 0,
    })

    logResponse(logRequest(method, path, user.id), 201, duration)

    return jsonSuccess(result.data, 201)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
