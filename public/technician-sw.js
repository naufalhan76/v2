// MSN Tech Service Worker — Shell (Phase 2)
// Push notification handler will be added in Phase 4.

const CACHE_NAME = 'msn-tech-v1'

// Minimal precache for app shell
const PRECACHE_URLS = [
  '/technician',
  '/technician-manifest.json',
]

// Install event — precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  // Claim all clients immediately
  self.clients.claim()
})

// Fetch event — network-first strategy (no offline-first)
self.addEventListener('fetch', (event) => {
  // Only handle same-origin navigation requests
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(() => {
      // If network fails, try cache
      return caches.match(event.request).then((cached) => {
        return cached || new Response('Offline — silakan cek koneksi internet Anda.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
    })
  )
})

// Push event placeholder — Phase 4
self.addEventListener('push', (event) => {
  // Will be implemented in Phase 4
  console.log('[SW] Push received (handler not yet active)')
})
