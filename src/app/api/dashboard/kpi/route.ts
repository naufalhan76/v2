import { NextRequest } from 'next/server'
import { getDashboardKpis } from '@/lib/actions/dashboard'
import { GetDashboardKpiQuerySchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * GET /api/dashboard/kpi
 * 
 * Fetch dashboard KPI data (total orders, ongoing, completed, etc.)
 * 
 * Query parameters:
 * - dateFrom: Filter from date (ISO string)
 * - dateTo: Filter to date (ISO string)
 * - customerId: Filter by customer (optional)
 * - technicianId: Filter by technician (optional)
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'GET'
  const path = '/api/dashboard/kpi'

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { type: 'kpi' })

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const queryInput = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      technicianId: searchParams.get('technicianId') || undefined,
    }

    const validation = GetDashboardKpiQuerySchema.safeParse(queryInput)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const filters = validation.data

    // Fetch dashboard KPI from server action
    const data = await getDashboardKpis(filters.dateFrom, filters.dateTo)

    const duration = getDuration()

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(data, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
