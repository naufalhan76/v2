import { NextResponse } from 'next/server'

// ============================================================================
// API RESPONSE HELPERS
// ============================================================================

export type ApiResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const successResponse = <T,>(
  data: T,
  pagination?: { total: number; page: number; limit: number; totalPages: number },
): ApiResponse<T> => ({
  success: true,
  data,
  ...(pagination && { pagination }),
})

export const errorResponse = (error: string | Error, message?: string): ApiResponse => ({
  success: false,
  error: error instanceof Error ? error.message : error,
  ...(message && { message }),
})

// ============================================================================
// HTTP RESPONSE HELPERS
// ============================================================================

export const jsonSuccess = <T,>(
  data: T,
  status: number = 200,
  pagination?: { total: number; page: number; limit: number; totalPages: number },
) => {
  return NextResponse.json(successResponse(data, pagination), { status })
}

export const jsonError = (error: string | Error, status: number = 400, message?: string) => {
  console.error('[API Error]', error)
  return NextResponse.json(errorResponse(error, message), { status })
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const handleApiError = (error: unknown) => {
  console.error('[API Handler Error]', error)

  if (error instanceof ApiError) {
    return jsonError(error.message, error.statusCode, JSON.stringify(error.details))
  }

  if (error instanceof Error) {
    // Check for common Supabase errors
    if (error.message.includes('row-level security')) {
      return jsonError('Access denied: Row-level security policy violation', 403)
    }
    if (error.message.includes('JWT')) {
      return jsonError('Unauthorized: Invalid or expired token', 401)
    }
    if (error.message.includes('foreign key')) {
      return jsonError('Invalid reference: Resource not found', 400)
    }
    if (error.message.includes('unique constraint')) {
      return jsonError('Duplicate entry: Resource already exists', 409)
    }

    return jsonError(error.message, 500)
  }

  return jsonError('An unexpected error occurred', 500)
}

// ============================================================================
// VALIDATION ERROR HANDLING
// ============================================================================

export const handleValidationError = (error: any) => {
  if (error?.issues) {
    const issues = error.issues.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
    return jsonError(`Validation failed: ${issues[0].message}`, 400, JSON.stringify(issues))
  }
  return jsonError('Validation failed', 400)
}

// ============================================================================
// AUTH ERROR RESPONSES
// ============================================================================

export const unauthorizedResponse = () => jsonError('Unauthorized: Missing or invalid authentication', 401)
export const forbiddenResponse = () => jsonError('Forbidden: Insufficient permissions', 403)
export const notFoundResponse = (resource: string) => jsonError(`${resource} not found`, 404)
