import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import type { NextRequest } from 'next/server'

export type ApiRole = 'SUPERADMIN' | 'ADMIN' | 'FINANCE' | 'TECHNICIAN'

type AuthSuccess = {
  authorized: true
  response: null
  user: { id: string; email?: string | null }
  role: ApiRole
}

type AuthFailure = {
  authorized: false
  response: NextResponse
  user: null
  role: null
}

export type ApiAuthResult = AuthSuccess | AuthFailure

export async function requireApiRole(
  request: NextRequest,
  allowedRoles: readonly ApiRole[],
): Promise<ApiAuthResult> {
  const { userId } = await auth()

  if (!userId) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
      role: null,
    }
  }

  const supabase = await createClient()
  const { data: userMgmt } = await supabase
    .from('user_management')
    .select('role, email')
    .eq('auth_user_id', userId)
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
    user: { id: userId, email: userMgmt?.email },
    role,
  }
}
