import { NextRequest } from 'next/server'
import { getCustomers, createCustomer } from '@/lib/actions/customers'
import { GetCustomersQuerySchema, CreateCustomerSchema } from '@/app/api/schemas'
import { jsonSuccess, jsonError, handleValidationError, handleApiError } from '@/app/api/utils'
import { requireAuth } from '@/app/api/middleware/auth'
import { logRequest, logResponse, measureDuration, createAuditLog } from '@/app/api/middleware/logging'

/**
 * GET /api/customers
 * 
 * Fetch customers with optional search and pagination
 * 
 * Query parameters:
 * - search: Search term for customer name, phone, email, address
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * 
 * Required: Authentication header with Bearer token
 */
export async function GET(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'GET'
  const path = '/api/customers'

  try {
    // Verify authentication (optional for MVP - allow anon access)
    const user = await requireAuth(request)
    
    logRequest(method, path, user?.id || 'anonymous', { type: 'list' })

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const queryInput = {
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const validation = GetCustomersQuerySchema.safeParse(queryInput)
    if (!validation.success) {
      logResponse(logRequest(method, path, user?.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const filters = validation.data

    // Fetch customers from server action
    const result = await getCustomers({
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user?.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to fetch customers', 400)
    }

    logResponse(logRequest(method, path, user?.id), 200, duration)

    return jsonSuccess(result.data, 200, result.pagination)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}

/**
 * POST /api/customers
 * 
 * Create a new customer
 * 
 * Body:
 * {
 *   "customerName": "string",
 *   "primaryContactPerson": "string (optional)",
 *   "email": "string (optional)",
 *   "phoneNumber": "string",
 *   "billingAddress": "string (optional)",
 *   "notes": "string (optional)"
 * }
 * 
 * Required: Authentication header with Bearer token
 */
export async function POST(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'POST'
  const path = '/api/customers'

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
    const validation = CreateCustomerSchema.safeParse(body)

    if (!validation.success) {
      logResponse(logRequest(method, path, user.id), 400, getDuration(), validation.error.message)
      return handleValidationError(validation.error)
    }

    const { customerName, primaryContactPerson, email, phoneNumber, billingAddress, notes } = validation.data

    // Create customer using server action
    const result = await createCustomer({
      customer_name: customerName,
      primary_contact_person: primaryContactPerson || 'N/A',
      email: email || '',
      phone_number: phoneNumber,
      billing_address: billingAddress || '',
      notes,
    })

    const duration = getDuration()

    if (!result.success) {
      logResponse(logRequest(method, path, user.id), 400, duration, result.error)
      return jsonError(result.error || 'Failed to create customer', 400)
    }

    // Log audit trail
    await createAuditLog(user.id, 'CREATE', 'customers', result.data?.customer_id || '', {
      customerName,
      phoneNumber,
    })

    logResponse(logRequest(method, path, user.id), 201, duration)

    return jsonSuccess(result.data, 201)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}