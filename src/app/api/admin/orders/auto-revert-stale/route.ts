import { NextRequest } from 'next/server'
import { autoRevertStaleOrders } from '@/lib/actions/orders-auto-revert'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { getUserFromRequest } from '@/app/api/middleware/auth'
import { logger } from '@/lib/logger'

const log = logger.child('api:admin:orders:auto-revert-stale')

export async function POST(request: NextRequest) {
  try {
    const authorized = await isAuthorized(request)
    if (!authorized) {
      return jsonError(
        'Unauthorized: SUPERADMIN/ADMIN role or CRON_SECRET required',
        403
      )
    }

    log.info('Auto-revert triggered', { actor: authorized.actor })

    const result = await autoRevertStaleOrders()

    if (!result.success) {
      log.error('Auto-revert failed', { error: result.error })
      return jsonError(result.error || 'Failed to auto-revert stale orders', 500)
    }

    log.info('Auto-revert completed', {
      reverted_count: result.reverted_count,
      order_ids: result.order_ids,
    })

    return jsonSuccess({
      reverted_count: result.reverted_count,
      order_ids: result.order_ids,
    })
  } catch (error) {
    log.error('Unexpected error in auto-revert endpoint', error)
    return handleApiError(error)
  }
}

type AuthResult = { actor: 'cron' | 'user'; userId?: string }

async function isAuthorized(request: NextRequest): Promise<AuthResult | null> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      if (timingSafeEqual(token, cronSecret)) {
        return { actor: 'cron' }
      }
    }
  }

  const user = await getUserFromRequest(request)
  if (!user) return null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error || !data?.role) return null
    if (!['SUPERADMIN', 'ADMIN'].includes(data.role)) return null

    return { actor: 'user', userId: user.id }
  } catch (error) {
    log.error('role lookup failed', error)
    return null
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
