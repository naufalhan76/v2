import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getUserFromRequest } from '@/app/api/middleware/auth'
import type { NextRequest } from 'next/server'

export type ApiRole = 'SUPERADMIN' | 'ADMIN' | 'FINANCE' | 'TECHNICIAN'

type AuthSuccess = {
  authorized: true
  response: null
  user: { id: string; email?: string }
  role: ApiRole
}

type AuthFailure = {
  authorized: false
  response: NextResponse
  user: null
  role: null
}

export type ApiAuthResult = AuthSuccess | AuthFailure

/**
 * Verify that the current request is from an authenticated user with one of the
 * allowed roles. Supports both Bearer token and cookie session authentication.
 *
 * Usage:
 * ```ts
 * const auth = await requireApiRole(request, ['ADMIN', 'FINANCE', 'SUPERADMIN'])
 * if (!auth.authorized) return auth.response
 * // auth.user and auth.role are now available
 * ```
 */
export async function requireApiRole(
  request: NextRequest,
  allowedRoles: readonly ApiRole[],
): Promise<ApiAuthResult> {
  // 1. Resolve user from Bearer token or cookie session
  let user = await getUserFromRequest(request)

  // Fallback to cookie session if getUserFromRequest didn't find a user
  if (!user) {
    try {
      const supabase = await createClient()
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser()
      user = sessionUser ?? null
    } catch {
      user = null
    }
  }

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
      role: null,
    }
  }

  // 2. Look up role from user_management
  const supabase = await createClient()
  const { data: userMgmt } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const role = userMgmt?.role as ApiRole | undefined

  if (!role || !allowedRoles.includes(role)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
      role: null,
    }
  }

  return {
    authorized: true,
    response: null,
    user: { id: user.id, email: user.email },
    role,
  }
}
