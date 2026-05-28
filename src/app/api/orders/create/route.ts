import { NextRequest } from 'next/server'
import { createOrder } from '@/lib/actions/orders'
import { CreateOrderSchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'
import { normalizeOrderServiceType } from '@/lib/service-types'
import { createAdminClient } from '@/lib/supabase-admin'

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

    const orderId = result.data?.order_id || result.data?.orderId || ''

    if (items && items.length > 0 && orderId) {
      const supabase = createAdminClient()
      const orderItems = items.map((item) => ({
        order_id: orderId,
        location_id: locationId,
        service_type: normalizeOrderServiceType(item.serviceType),
        quantity: item.quantity ?? 1,
        estimated_price: item.estimatedPrice ?? 0,
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        logResponse(logRequest(method, path, user.id), 500, getDuration(), itemsError.message)
        return jsonError('Order created but failed to insert items: ' + itemsError.message, 500)
      }
    }

    await createAuditLog(user.id, 'CREATE', 'orders', orderId, {
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
