'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/technician-sw.js', { scope: '/technician' })
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope)
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error)
        })
    }
  }, [])

  return null
}
