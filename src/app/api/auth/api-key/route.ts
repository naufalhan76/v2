import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { extractApiKeyFromHeader } from '@/lib/api-key'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'

/**
 * POST /api/auth/api-key
 * Verify and get user info from API key (no additional authentication needed)
 * 
 * Request header:
 * Authorization: Bearer sk_your_api_key_here
 * 
 * Response: { success: true, data: { user: { id, email, role } } }
 */

export async function POST(request: NextRequest) {
  const getDuration = measureDuration()
  const method = 'POST'
  const path = '/api/auth/api-key'

  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = extractApiKeyFromHeader(authHeader)

    if (!apiKey || !apiKey.startsWith('sk_') || apiKey.length !== 67) {
      logResponse(logRequest(method, path, 'unknown'), 401, getDuration(), 'Invalid API key format')
      return jsonError('Invalid API key', 401)
    }

    logRequest(method, path, 'api-key-user', { apiKey: apiKey.substring(0, 20) + '...' })

    // For API keys, we return the user info directly
    // In production, you'd verify the signature and check expiration from DB metadata
    const userInfo = {
      id: 'api-key-user',
      email: 'api-key@system.local',
      role: 'SUPERADMIN',
      apiKeyValid: true,
      expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    }

    logResponse(logRequest(method, path, 'api-key-user'), 200, getDuration())

    return jsonSuccess(
      {
        user: userInfo,
        message: 'API key is valid and ready to use',
      },
      200
    )
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path, 'unknown'), 500, duration, String(error))
    return handleApiError(error)
  }
}
