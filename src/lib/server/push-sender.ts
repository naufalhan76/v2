/**
 * Server-side push fan-out.
 *
 * Public API:
 *   - sendPushToUser(userId, payload)
 *   - sendJobAssignedNotification(orderId, technicianId)
 *   - sendJobRescheduledNotification(orderId, technicianId, newDate)
 *   - sendJobReassignedAwayNotification(orderId, technicianId)
 *
 * All four are fire-and-forget by design — push failures should never break
 * the originating action. Errors are logged via the project logger.
 */
import 'server-only'
import webpush, { type PushSubscription as WebPushSub } from 'web-push'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

const log = logger.child('push-sender')

// ----------------------------------------------------------------------------
// VAPID setup (idempotent — safe to call once per cold start)
// ----------------------------------------------------------------------------
let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    log.warn('VAPID env vars missing — push notifications disabled', {
      hasSubject: !!subject,
      hasPublic: !!publicKey,
      hasPrivate: !!privateKey,
    })
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

// ----------------------------------------------------------------------------
// Payload contract — must match what `public/technician-sw.js` expects.
// ----------------------------------------------------------------------------
export interface PushPayload {
  title: string
  body: string
  /** Deep link relative path. Defaults to /technician on the SW side. */
  url?: string
  /** Collapse key — replaces an existing notification with the same tag. */
  tag?: string
  /** Order ID, included for analytics/debugging. */
  orderId?: string
}

// ----------------------------------------------------------------------------
// Core sender
// ----------------------------------------------------------------------------

/**
 * Send `payload` to every active subscription of `userId`.
 * Failed-permanently subscriptions (HTTP 404/410) are deleted from the DB.
 *
 * Returns counts so callers can log/observe outcomes.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, pruned: 0, failed: 0 }
  }

  const admin = createAdminClient()

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('subscription_id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    log.error('Failed to load push subscriptions', { userId, error })
    return { sent: 0, pruned: 0, failed: 0 }
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, pruned: 0, failed: 0 }
  }

  const body = JSON.stringify(payload)

  const results = await Promise.allSettled(
    subs.map((s) => {
      const sub: WebPushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      return webpush.sendNotification(sub, body).then(
        () => ({ kind: 'ok' as const, id: s.subscription_id }),
        (err: { statusCode?: number; body?: string }) => ({
          kind: 'err' as const,
          id: s.subscription_id,
          status: err.statusCode,
          body: err.body,
        })
      )
    })
  )

  // Find permanently-failed subs to prune. 404 = endpoint never existed,
  // 410 = "Gone" = unsubscribed at the push service.
  const toPrune: string[] = []
  let sent = 0
  let failed = 0

  for (const r of results) {
    if (r.status !== 'fulfilled') {
      failed++
      continue
    }
    const v = r.value
    if (v.kind === 'ok') {
      sent++
    } else {
      failed++
      if (v.status === 404 || v.status === 410) {
        toPrune.push(v.id)
      } else {
        log.warn('Push send failed (transient)', {
          userId,
          status: v.status,
          body: v.body,
        })
      }
    }
  }

  let pruned = 0
  if (toPrune.length > 0) {
    const { error: deleteError, count } = await admin
      .from('push_subscriptions')
      .delete({ count: 'exact' })
      .in('subscription_id', toPrune)
    if (deleteError) {
      log.error('Failed to prune dead subscriptions', { error: deleteError })
    } else {
      pruned = count ?? toPrune.length
    }
  }

  log.debug('Push fan-out complete', { userId, sent, pruned, failed })
  return { sent, pruned, failed }
}

// ----------------------------------------------------------------------------
// Helper: resolve technician's auth_user_id from technician_id.
// We push by Supabase auth user id; the order-actions caller has technician_id.
// ----------------------------------------------------------------------------
async function resolveAuthUserId(technicianId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('technicians')
    .select('auth_user_id')
    .eq('technician_id', technicianId)
    .maybeSingle()
  if (error || !data?.auth_user_id) {
    log.warn('Could not resolve auth_user_id for technician', { technicianId, error })
    return null
  }
  return data.auth_user_id
}

// ----------------------------------------------------------------------------
// Specific notification builders
// ----------------------------------------------------------------------------

/**
 * Tech was newly assigned to an order. URL deep-links to the job detail.
 */
export async function sendJobAssignedNotification(
  orderId: string,
  technicianId: string
): Promise<void> {
  const userId = await resolveAuthUserId(technicianId)
  if (!userId) return

  // Fetch a tiny snippet for a humane body
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select(
      `order_id, scheduled_visit_date,
       customers (customer_name)`
    )
    .eq('order_id', orderId)
    .maybeSingle()

  const customerName =
    (order?.customers as { customer_name?: string } | null)?.customer_name ?? 'pelanggan'
  const date = order?.scheduled_visit_date
    ? new Date(order.scheduled_visit_date).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null

  await sendPushToUser(userId, {
    title: 'Job baru ditugaskan',
    body: date
      ? `${customerName} • jadwal ${date}`
      : `${customerName}`,
    url: `/technician/job/${orderId}`,
    tag: `job-assigned:${orderId}`,
    orderId,
  }).catch((err) => log.error('sendJobAssignedNotification failed', err))
}

/**
 * Existing assignment was rescheduled to a new date.
 */
export async function sendJobRescheduledNotification(
  orderId: string,
  technicianId: string,
  newDate: string
): Promise<void> {
  const userId = await resolveAuthUserId(technicianId)
  if (!userId) return

  const formatted = new Date(newDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  await sendPushToUser(userId, {
    title: 'Job dijadwal ulang',
    body: `Jadwal baru: ${formatted}. Tap untuk detail.`,
    url: `/technician/job/${orderId}`,
    tag: `job-rescheduled:${orderId}`,
    orderId,
  }).catch((err) => log.error('sendJobRescheduledNotification failed', err))
}

/**
 * Notify the OLD lead technician that a job has been reassigned away.
 */
export async function sendJobReassignedAwayNotification(
  orderId: string,
  technicianId: string
): Promise<void> {
  const userId = await resolveAuthUserId(technicianId)
  if (!userId) return

  await sendPushToUser(userId, {
    title: 'Job dipindahkan ke teknisi lain',
    body: `Order ${orderId} sudah tidak ditugaskan ke kamu.`,
    url: '/technician',
    tag: `job-reassigned-away:${orderId}`,
    orderId,
  }).catch((err) => log.error('sendJobReassignedAwayNotification failed', err))
}
