// MSN Tech Service Worker
// Phase 2: app shell + offline fallback
// Phase 4: push notifications

const CACHE_NAME = 'msn-tech-v2'

const PRECACHE_URLS = [
  '/technician',
  '/technician-manifest.json',
]

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for navigations, cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(
        (cached) =>
          cached ||
          new Response('Offline — silakan cek koneksi internet Anda.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      )
    )
  )
})

// =========================================================================
// Push notifications (Phase 4)
// =========================================================================

/**
 * Push payload contract (negotiated with src/lib/server/push-sender.ts):
 *   {
 *     title: string,
 *     body: string,
 *     url?: string,         // deep link, default '/technician'
 *     tag?: string,         // collapse key
 *     orderId?: string,     // included for observability
 *   }
 *
 * Falls back to a generic notification if payload is missing/invalid so the
 * user is never silently dropped.
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    if (event.data) payload = event.data.json()
  } catch (err) {
    // Treat as plain text if JSON parse fails
    try {
      payload = { title: 'MSN Tech', body: event.data ? event.data.text() : '' }
    } catch (_e) {
      payload = {}
    }
  }

  const title = payload.title || 'MSN Tech'
  const options = {
    body: payload.body || 'Notifikasi baru',
    icon: '/icons/tech-icon-192.png',
    badge: '/icons/tech-icon-192.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: {
      url: payload.url || '/technician',
      orderId: payload.orderId || null,
    },
    // Vibrate pattern is best-effort; ignored on iOS Safari.
    vibrate: [120, 60, 120],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

/**
 * Notification click — focus an existing tab pointing at the URL or open a
 * new one. Always closes the notification first.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || '/technician'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Try to focus an existing window already on this URL
        for (const client of clients) {
          try {
            const url = new URL(client.url)
            if (url.pathname === targetUrl || url.pathname.startsWith(targetUrl)) {
              return client.focus()
            }
          } catch (_e) {
            // ignore parse errors
          }
        }
        // Otherwise focus the first technician window and navigate it…
        for (const client of clients) {
          try {
            const url = new URL(client.url)
            if (url.pathname.startsWith('/technician')) {
              return client.focus().then((c) =>
                c && 'navigate' in c ? c.navigate(targetUrl) : null
              )
            }
          } catch (_e) {
            // ignore
          }
        }
        // …or open a brand-new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
        return null
      })
  )
})

/**
 * Subscription change — browsers periodically rotate keys / drop subscriptions.
 * Resubscribe with the same VAPID key, then notify the server. The VAPID public
 * key is hardcoded into a fetched config so the SW does not need bundler env.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Fetch current public key from a tiny config endpoint so we don't have
        // to bake it into the SW at build time.
        const res = await fetch('/api/technician/push/public-key')
        if (!res.ok) throw new Error('Failed to fetch VAPID key')
        const { publicKey } = await res.json()
        if (!publicKey) throw new Error('No VAPID public key returned')

        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })

        await fetch('/api/technician/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        })
      } catch (err) {
        // Swallow — there is nothing else the SW can do here. The next time
        // the user opens the app, the profile page will reconcile state.
        console.warn('[SW] pushsubscriptionchange failed:', err)
      }
    })()
  )
})

// Inline copy of urlBase64ToUint8Array — duplicated from src/lib/push.ts
// because the SW cannot import from app code.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i)
  }
  return out
}
