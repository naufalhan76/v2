import { NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { createClient } from '@/lib/supabase-server'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { logger } from '@/lib/logger'

const log = logger.child('api-push-subscribe')

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
})

/**
 * POST /api/technician/push/subscribe
 *
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Inserts (or upserts on conflict of user_id+endpoint) a row into
 * `push_subscriptions`. Authenticated technician only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateTechnician(request)
    if (!isTechnicianContext(auth)) return auth

    const body = await request.json()
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(
        `Invalid payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
        400
      )
    }

    const { endpoint, keys, userAgent } = parsed.data
    const supabase = await createClient()

    // Upsert on (user_id, endpoint) to make this idempotent —
    // a re-subscribe should not error.
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: auth.userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent ?? request.headers.get('user-agent') ?? null,
        },
        { onConflict: 'user_id,endpoint' }
      )

    if (error) {
      log.error('Failed to upsert subscription', error)
      throw error
    }

    return jsonSuccess({ subscribed: true }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
