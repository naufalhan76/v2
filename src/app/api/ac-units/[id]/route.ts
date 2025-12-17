import { NextRequest } from 'next/server'
import { getAcUnitById, updateAcUnit, deleteAcUnit } from '@/lib/actions/ac-units'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * GET /api/ac-units/[id]
 * 
 * Fetch a specific AC unit by ID
 * 
 * Path parameters:
 * - id: AC Unit ID (e.g., AC-001)
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const getDuration = measureDuration()
  const method = 'GET'
  
  try {
    const { id } = await params
    const path = `/api/ac-units/${id}`

    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { acUnitId: id })

    const result = await getAcUnitById(id)

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 404, getDuration(), result.error)
      return jsonError(result.error || 'AC unit not found', 404)
    }

    const duration = getDuration()
    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, ''), 500, duration, String(error))
    return handleApiError(error)
  }
}

/**
 * PUT /api/ac-units/[id]
 * 
 * Update an AC unit
 * 
 * Path parameters:
 * - id: AC Unit ID
 * 
 * Request body (all optional):
 * {
 *   "brand": "Daikin",
 *   "model_number": "FTXV35M",
 *   "serial_number": "SN123456",
 *   "ac_type": "WALL_MOUNTED",
 *   "capacity_btu": 12000,
 *   "installation_date": "2023-01-15",
 *   "status": "ACTIVE"
 * }
 * 
 * Required: Authentication header with Bearer token
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const getDuration = measureDuration()
  const method = 'PUT'
  
  try {
    const { id } = await params
    const path = `/api/ac-units/${id}`
    const body = await request.json()

    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { acUnitId: id, data: body })

    // Update AC unit using server action
    const result = await updateAcUnit(id, {
      brand: body.brand,
      model_number: body.model_number,
      serial_number: body.serial_number,
      ac_type: body.ac_type,
      capacity_btu: body.capacity_btu ? Number(body.capacity_btu) : undefined,
      installation_date: body.installation_date,
      status: body.status,
    })

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 : 400
      logResponse(logRequest(method, path, user.id), status, getDuration(), result.error)
      return jsonError(result.error || 'Failed to update AC unit', status)
    }

    const duration = getDuration()
    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess(result.data, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, ''), 500, duration, String(error))
    return handleApiError(error)
  }
}

/**
 * DELETE /api/ac-units/[id]
 * 
 * Delete an AC unit
 * 
 * Path parameters:
 * - id: AC Unit ID
 * 
 * Required: Authentication header with Bearer token
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const getDuration = measureDuration()
  const method = 'DELETE'
  
  try {
    const { id } = await params
    const path = `/api/ac-units/${id}`

    // Verify authentication
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { acUnitId: id })

    const result = await deleteAcUnit(id)

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 : 400
      logResponse(logRequest(method, path, user.id), status, getDuration(), result.error)
      return jsonError(result.error || 'Failed to delete AC unit', status)
    }

    const duration = getDuration()
    logResponse(logRequest(method, path, user.id), 200, duration)

    return jsonSuccess({ id, message: 'AC unit deleted successfully' }, 200)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, ''), 500, duration, String(error))
    return handleApiError(error)
  }
}
