import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError, handleApiError, handleValidationError } from '@/app/api/utils'
import { z } from 'zod'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * POST /api/auth/login
 * Authenticate with email/password and get JWT token
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 * 
 * Response: { success: true, data: { token: "eyJ...", user: {...} } }
 */

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginRequest = z.infer<typeof LoginSchema>

export async function POST(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'POST'
  const path = '/api/auth/login'

  try {
    const body = await request.json()
    
    // Validate request body
    const result = LoginSchema.safeParse(body)
    if (!result.success) {
      logResponse(logRequest(method, path, 'unknown'), 400, getDuration(), 'Validation failed')
      return handleValidationError(result.error)
    }

    const { email, password } = result.data

    logRequest(method, path, 'anonymous', { email })

    // Use Supabase to authenticate
    const { createClient } = await import('@/lib/supabase-server')
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      logResponse(logRequest(method, path, 'unknown'), 401, getDuration(), error?.message || 'Authentication failed')
      return jsonError('Invalid email or password', 401)
    }

    const user = data.user
    const token = data.session.access_token

    logRequest(method, path, user.id, { email: user.email })
    logResponse(logRequest(method, path, user.id), 200, getDuration())

    return jsonSuccess(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
      },
      200
    )
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path, 'unknown'), 500, duration, String(error))
    return handleApiError(error)
  }
}
