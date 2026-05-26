/**
 * Browser-side helpers for Web Push notifications.
 *
 * Responsibilities:
 *  - Detect feature support
 *  - Convert VAPID public key (URL-safe base64) → Uint8Array for the Push API
 *  - Read current subscription
 *  - Subscribe / unsubscribe with the active service worker
 *
 * UI concerns (toggle, toasts, persistence to backend) live in callers.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type PushSupport = {
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
  /** All three present — push is usable. */
  fullySupported: boolean
}

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Convert a URL-safe base64 string to a Uint8Array, as required by
 * `PushManager.subscribe({ applicationServerKey })`.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Using_the_Push_API
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  // Back the Uint8Array with a concrete ArrayBuffer (not ArrayBufferLike) so the
  // result is assignable to BufferSource for PushManager.subscribe().
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i)
  }
  return out
}

/** Detect what is available in the current browser. */
export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return {
      serviceWorker: false,
      pushManager: false,
      notification: false,
      fullySupported: false,
    }
  }
  const sw = 'serviceWorker' in navigator
  const pm = 'PushManager' in window
  const n = 'Notification' in window
  return {
    serviceWorker: sw,
    pushManager: pm,
    notification: n,
    fullySupported: sw && pm && n,
  }
}

/** Convenience: simple boolean check used by callers that don't need details. */
export function isPushSupported(): boolean {
  return getPushSupport().fullySupported
}

/** Read the current Notification permission state. */
export function getPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as PushPermissionState
}

/** Get the active push subscription for this browser, if any. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!getPushSupport().fullySupported) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Request notification permission and subscribe to push.
 * Throws if support missing, permission denied, or VAPID key missing.
 *
 * Returns the new (or existing) PushSubscription. Caller is responsible for
 * sending the subscription payload to the server.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!getPushSupport().fullySupported) {
    throw new Error('Push notifications are not supported in this browser')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured')
  }

  // Permission flow — Notification.requestPermission must be called from a
  // user gesture (e.g., click handler) per browser policy.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission denied'
        : 'Notification permission was dismissed'
    )
  }

  const reg = await navigator.serviceWorker.ready

  // Reuse existing subscription if present
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
}

/**
 * Unsubscribe the active subscription, if any. Returns the old subscription
 * (so callers can send it to the server for cleanup) or null.
 */
export async function unsubscribeFromPush(): Promise<PushSubscription | null> {
  const sub = await getPushSubscription()
  if (!sub) return null
  await sub.unsubscribe()
  return sub
}

/**
 * Serialize a PushSubscription to the JSON shape the server expects.
 * Uses `subscription.toJSON()` and asserts the keys we need.
 */
export function serializeSubscription(sub: PushSubscription): {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  const json = sub.toJSON()
  const endpoint = json.endpoint ?? sub.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error('PushSubscription is missing required fields')
  }
  return { endpoint, keys: { p256dh, auth } }
}
