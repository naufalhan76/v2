import { NextRequest } from 'next/server'
import { generateRemindersFromAcUnits } from '@/lib/actions/reminders'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { getUserFromRequest } from '@/app/api/middleware/auth'
import { logger } from '@/lib/logger'

const log = logger.child('api:admin:reminders:run')

/**
 * POST /api/admin/reminders/run
 *
 * Trigger reminder generation from AC units (service due dates, warranty
 * expiry, etc.). Intended for both manual admin invocation and scheduled cron
 * jobs.
 *
 * Auth:
 *   - `Authorization: Bearer <CRON_SECRET>` (when CRON_SECRET env var is set)
 *   - OR an authenticated SUPERADMIN / ADMIN session (cookie or Bearer JWT)
 *
 * Response:
 *   { success: true, data: { generated_count: number, skipped_count: number } }
 */
export async function POST(request: NextRequest) {
  try {
    const authorized = await isAuthorized(request)
    if (!authorized) {
      return jsonError('Unauthorized: SUPERADMIN/ADMIN role or CRON_SECRET required', 403)
    }

    log.info('Reminder generation triggered', { actor: authorized.actor })

    // Authorization is handled in this route handler (cron secret or admin
    // role); skip the action's own cookie-based role check so cron calls
    // without a user session also work.
    const result = await generateRemindersFromAcUnits({ asSystem: true })

    if (!result.success) {
      log.error('Reminder generation failed', result.error)
      return jsonError(result.error || 'Failed to generate reminders', 500)
    }

    const generated = result.success && 'data' in result ? (result.data?.created ?? 0) : 0
    const skipped = result.success && 'data' in result ? (result.data?.skipped ?? 0) : 0
    const rulesScanned =
      result.success && 'data' in result ? (result.data?.rulesScanned ?? 0) : 0

    log.info('Reminder generation completed', {
      generated_count: generated,
      skipped_count: skipped,
      rules_scanned: rulesScanned,
    })

    return jsonSuccess({
      generated_count: generated,
      skipped_count: skipped,
    })
  } catch (error) {
    log.error('Unexpected error in reminder generation', error)
    return handleApiError(error)
  }
}

type AuthResult = { actor: 'cron' | 'user'; userId?: string }

async function isAuthorized(request: NextRequest): Promise<AuthResult | null> {
  // 1. Cron secret check (only if env var is configured)
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

  // 2. Authenticated user check — Bearer JWT first, fall back to cookie session
  let user = await getUserFromRequest(request)
  if (!user) {
    try {
      const supabase = await createClient()
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser()
      user = sessionUser ?? null
    } catch (error) {
      log.error('cookie auth lookup failed', error)
      user = null
    }
  }

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

/**
 * Constant-time string comparison to avoid timing attacks on the cron secret.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
