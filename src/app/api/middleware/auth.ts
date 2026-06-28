import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { errorResponse, unauthorizedResponse } from '@/app/api/utils'
import { logger } from '@/lib/logger'

const log = logger.child('auth-middleware')

export type ApiRequest = NextRequest & {
  user?: {
    id: string
    email?: string
    role?: string
  }
}

export async function verifyAuth(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return unauthorizedResponse()
    return { id: userId }
  } catch (error) {
    log.error('verifyAuth failed', error)
    return unauthorizedResponse()
  }
}

export async function getUserFromRequest(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return null
    return { id: userId }
  } catch (error) {
    log.error('getUserFromRequest failed', error)
    return null
  }
}

export async function checkRole(request: NextRequest, requiredRoles: string[]) {
  const { userId } = getAuth(request)
  if (!userId) return false

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (error || !data?.role) return false
    return requiredRoles.includes(data.role)
  } catch (error) {
    log.error('checkRole failed', error)
    return false
  }
}

export async function requireAuth(request: NextRequest) {
  return getUserFromRequest(request)
}

export async function requireFinanceRoleAPI(request: NextRequest): Promise<NextResponse | null> {
  const { userId } = getAuth(request)

  if (!userId) {
    return NextResponse.json(errorResponse('Unauthorized: Finance role required'), {
      status: 403,
    })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', userId)
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
