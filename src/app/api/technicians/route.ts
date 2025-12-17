import { NextRequest } from 'next/server'
import { getTechnicians } from '@/lib/actions/technicians'
import { GetTechniciansQuerySchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * GET /api/technicians
 * 
 * Fetch technicians with optional search and pagination
 * 
 * Query parameters:
 * - search: Search term for technician name, contact
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'GET'
  const path = '/api/technicians'

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
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const validation = GetTechniciansQuerySchema.safeParse(queryInput)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const filters = validation.data

    // Fetch technicians from server action
    const result = await getTechnicians({
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to fetch technicians', 400)
    }

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200, result.pagination)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
