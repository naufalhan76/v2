import { NextRequest } from 'next/server'
import { jsonError } from '@/app/api/utils'

/**
 * POST /api/auth/api-key
 * API key verification is not yet implemented.
 * Proper implementation requires a key store + HMAC verification.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  return jsonError('API key verification not yet implemented', 501)
}
