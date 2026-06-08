// MSN Tech Service Worker
// Phase 2: app shell + offline fallback
// Phase 4: push notifications
// Phase 6: offline sync (Background Sync API + online-event fallback)
//
// IMPORTANT: bump CACHE_NAME on every change to this file. Existing push
// handlers must remain intact — push notifications are a P0 regression risk
// when this SW updates.

const CACHE_NAME = 'msn-tech-v3'
const SYNC_TAG_REPORTS = 'msn-tech-sync-reports'
const SYNC_TAG_TRANSITIONS = 'msn-tech-sync-transitions'

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
    caches.keys().then((names) => {
      const deletions = []
      for (const name of names) {
        if (name !== CACHE_NAME) deletions.push(caches.delete(name))
      }
      return Promise.all(deletions)
    })
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

// =========================================================================
// Background sync (Phase 6)
//
// On `sync` events the SW only nudges open clients to drain their queues —
// the actual upload logic lives in `src/lib/offline/sync-manager.ts` so it
// can share TypeScript types with the rest of the app and use the
// authenticated supabase-js client (refresh token flow).
//
// iOS Safari does NOT support Background Sync. The client-side
// `useOnlineSync` hook is the primary trigger; this SW path is an
// enhancement on Chromium / Android.
// =========================================================================

async function notifyClientsToSync(reason) {
  const clientsList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of clientsList) {
    client.postMessage({ type: 'SYNC_REQUEST', reason })
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG_REPORTS || event.tag === SYNC_TAG_TRANSITIONS) {
    event.waitUntil(notifyClientsToSync(event.tag))
  }
})

self.addEventListener('message', (event) => {
  // Allow the client to ask the SW to register a one-shot background sync.
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    const tag = event.data.tag || SYNC_TAG_REPORTS
    if ('sync' in self.registration) {
      // Best-effort — failure (e.g. permission policy) is silent; the client
      // online-event listener still drives the queue.
      self.registration.sync.register(tag).catch(() => {})
    }
  }
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' })
      }
    })
  )
})

// Subscribe-side utilities live in src/lib/push.ts
