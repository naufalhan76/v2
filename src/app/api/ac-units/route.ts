import { NextRequest } from 'next/server'
import { getAcUnits, createAcUnit } from '@/lib/actions/ac-units'
import { jsonSuccess, jsonError, handleApiError, handleValidationError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'
import { z } from 'zod'

const GetAcUnitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
  search: z.string().optional(),
  location_id: z.string().uuid().optional(),
})

const CreateAcUnitSchema = z.object({
  location_id: z.string().uuid(),
  brand: z.string().min(1),
  model_number: z.string().min(1),
  serial_number: z.string().min(1),
  ac_type: z.string().min(1),
  capacity_btu: z.number().positive(),
  installation_date: z.string().datetime().optional(),
  status: z.string().optional(),
})

/**
 * GET /api/ac-units
 * 
 * Fetch AC units with optional filters
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - search: Search by brand or model
 * - location_id: Filter by location UUID
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'GET'
  const path = '/api/ac-units'

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
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      location_id: searchParams.get('location_id') || undefined,
    }

    const validation = GetAcUnitsQuerySchema.safeParse(queryInput)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const filters = validation.data

    // Fetch AC units from server action
    const result = await getAcUnits({
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to fetch AC units', 400)
    }

    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200, result.pagination)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}

/**
 * POST /api/ac-units
 * 
 * Create a new AC unit
 * 
 * Request body:
 * {
 *   "location_id": "uuid",
 *   "brand": "Daikin",
 *   "model_number": "FTXV35M",
 *   "serial_number": "SN123456",
 *   "ac_type": "WALL_MOUNTED",
 *   "capacity_btu": 12000,
 *   "installation_date": "2023-01-15T00:00:00Z",
 *   "status": "ACTIVE"
 * }
 * 
 * Required: Authentication header with Bearer token
 */
export async function POST(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'POST'
  const path = '/api/ac-units'

  try {
    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    const body = await request.json()

    logRequest(method, path, user.id, { data: body })

    // Validate request body
    const validation = CreateAcUnitSchema.safeParse(body)
    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const acUnitData = validation.data

    // Create AC unit using server action
    const result = await createAcUnit(acUnitData)

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to create AC unit', 400)
    }

    logResponse(logRequest(method, path, user.id), 201, duration)

    return jsonSuccess(result.data, 201)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
