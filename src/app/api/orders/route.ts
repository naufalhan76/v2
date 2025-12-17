import { NextRequest } from 'next/server'
import { getOrders } from '@/lib/actions/orders'
import { GetOrdersQuerySchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * GET /api/orders
 * 
 * Fetch orders with optional filters
 * 
 * Query parameters:
 * - status: Filter by single status
 * - statusIn: Filter by multiple statuses (comma-separated)
 * - customerId: Filter by customer ID
 * - technician_id: Filter by technician ID
 * - dateFrom: Filter from date (ISO string)
 * - dateTo: Filter to date (ISO string)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'GET'
  const path = '/api/orders'

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { type: 'list' })

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const queryInput = {
      status: searchParams.get('status') || undefined,
      statusIn: searchParams.get('statusIn') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      technician_id: searchParams.get('technician_id') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const validation = GetOrdersQuerySchema.safeParse(queryInput)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const filters = validation.data

    // Fetch orders from server action
    const result = await getOrders({
      status: filters.status,
      statusIn: filters.statusIn,
      customerId: filters.customerId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      limit: filters.limit,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to fetch orders', 400)
    }

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200, result.pagination)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
