import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { errorResponse, unauthorizedResponse } from '@/app/api/utils'
import { logger } from '@/lib/logger'

const log = logger.child('auth-middleware')

export type ApiRequest = NextRequest & {
  user?: {
    id: string
    email: string
    role?: string
  }
}

/**
 * Verify JWT token from Authorization header. Returns the Supabase user on
 * success or an `unauthorizedResponse()` on failure.
 */
export async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse()
    }

    const token = authHeader.substring(7)
    const supabase = await createClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return unauthorizedResponse()
    }

    return user
  } catch (error) {
    log.error('verifyAuth failed', error)
    return unauthorizedResponse()
  }
}

/**
 * Resolve a user from the Authorization header (JWT only).
 *
 * NOTE: API key authentication is intentionally not supported here. The legacy
 * implementation accepted any string matching `sk_<64 chars>` as SUPERADMIN
 * with no verification, which is a critical auth bypass. Re-enable only when a
 * proper key store + HMAC verification is in place (see `src/lib/api-key.ts`).
 */
export async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser(token)

    return user ?? null
  } catch (error) {
    log.error('getUserFromRequest failed', error)
    return null
  }
}

/**
 * Check whether the authenticated user has any of the required roles.
 */
export async function checkRole(request: NextRequest, requiredRoles: string[]) {
  const user = await getUserFromRequest(request)
  if (!user) return false

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error || !data?.role) return false
    return requiredRoles.includes(data.role)
  } catch (error) {
    log.error('checkRole failed', error)
    return false
  }
}

/**
 * Require authentication. Returns the user or null.
 */
export async function requireAuth(request: NextRequest) {
  return getUserFromRequest(request)
}

/**
 * Require a finance-capable role (SUPERADMIN, ADMIN, or FINANCE).
 */
export async function requireFinanceRoleAPI(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization')
  let user = null

  // Try bearer token first
  if (authHeader?.startsWith('Bearer ')) {
    user = await getUserFromRequest(request)
  } else {
    // Fall back to cookie session
    try {
      const supabase = await createClient()
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser()
      user = sessionUser ?? null
    } catch (error) {
      log.error('requireFinanceRoleAPI cookie auth failed', error)
      user = null
    }
  }

  if (!user) {
    return NextResponse.json(errorResponse('Unauthorized: Finance role required'), {
      status: 403,
    })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error || !data?.role || !['SUPERADMIN', 'ADMIN', 'FINANCE'].includes(data.role)) {
      return NextResponse.json(errorResponse('Unauthorized: Finance role required'), {
        status: 403,
      })
    }

    return null
  } catch (error) {
    log.error('requireFinanceRoleAPI failed', error)
    return NextResponse.json(errorResponse('Unauthorized: Finance role required'), {
      status: 403,
    })
  }
}
