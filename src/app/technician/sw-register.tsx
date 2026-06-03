'use client'

import { useEffect } from 'react'
import { subscribeToPush, serializeSubscription } from '@/lib/push'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister().catch(() => undefined))
      })
      return
    }

    navigator.serviceWorker
      .register('/technician-sw.js', { scope: '/technician' })
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope)
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error)
      })

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return
      subscribeToPush()
        .then((sub) => {
          return fetch('/api/technician/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serializeSubscription(sub)),
          })
        })
        .catch((err) => {
          console.warn('[SW] Re-subscribe after pushsubscriptionchange failed:', err)
        })
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
