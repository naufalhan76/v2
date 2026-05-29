/**
 * Auth refresh helper for the offline sync layer.
 *
 * Supabase-js stores its session in localStorage and refreshes proactively
 * when the SDK is online. After a long offline window the access token may
 * have expired by the time we get a chance to drain the queue — calling
 * `getSession()` triggers an automatic refresh using the stored refresh
 * token. We surface a typed result so the sync manager can react to a
 * refresh-token failure without silently dropping the queue.
 */

import { createClient } from '@/lib/supabase-browser'

export type AuthRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number }
  | { ok: false; reason: 'no-session' | 'refresh-failed'; message: string }

// Mutex: coalesces concurrent calls into a single Supabase round-trip.
// Cleared in the outer finally so both success and error paths reset it.
let inflight: Promise<AuthRefreshResult> | null = null

export async function refreshSession(): Promise<AuthRefreshResult> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const supabase = createClient()
      // getSession() returns the cached session and refreshes it if needed.
      // refreshSession() forces a network call — we use it only when the
      // cached one is close to expiry.
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        return { ok: false, reason: 'refresh-failed', message: error.message }
      }
      if (!data.session) {
        return {
          ok: false,
          reason: 'no-session',
          message: 'No cached Supabase session — user must re-login',
        }
      }

      const expiresAtSec = data.session.expires_at ?? 0
      const expiresAtMs = expiresAtSec * 1000
      const now = Date.now()

      // If we're within 60 seconds of expiry, force a refresh.
      if (expiresAtMs - now < 60_000) {
        const { data: refreshed, error: refreshErr } =
          await supabase.auth.refreshSession()
        if (refreshErr || !refreshed.session) {
          return {
            ok: false,
            reason: 'refresh-failed',
            message: refreshErr?.message ?? 'refreshSession returned no session',
          }
        }
        return {
          ok: true,
          accessToken: refreshed.session.access_token,
          expiresAt: (refreshed.session.expires_at ?? 0) * 1000,
        }
      }

      return {
        ok: true,
        accessToken: data.session.access_token,
        expiresAt: expiresAtMs,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'refresh-failed', message: msg }
    }
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}
