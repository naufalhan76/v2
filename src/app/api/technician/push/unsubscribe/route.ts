import { NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { createClient } from '@/lib/supabase-server'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { logger } from '@/lib/logger'

const log = logger.child('api-push-unsubscribe')

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/**
 * DELETE /api/technician/push/unsubscribe
 *
 * Body: { endpoint }
 *
 * Removes the matching row from `push_subscriptions`. RLS scopes by user.
 * Idempotent — deleting a missing row returns success.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateTechnician(request)
    if (!isTechnicianContext(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const parsed = unsubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(
        `Invalid payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
        400
      )
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', auth.userId)
      .eq('endpoint', parsed.data.endpoint)

    if (error) {
      log.error('Failed to delete subscription', error)
      throw error
    }

    return jsonSuccess({ unsubscribed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
