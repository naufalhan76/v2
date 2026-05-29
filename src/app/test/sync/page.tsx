'use client'

import { useEffect } from 'react'
import { drainQueue, enqueuePhoto } from '@/lib/offline/sync-manager'

// Expose synchronously so Playwright waitForFunction resolves as soon as the
// script chunk is parsed — before React hydration completes.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__drainQueue = drainQueue
  ;(window as unknown as Record<string, unknown>).__enqueuePhoto = enqueuePhoto
}

/**
 * Dev-only test harness for drainQueue.
 * Exposes window.__drainQueue so Playwright can call it directly.
 *
 * Routable at /test/sync (Next.js App Router treats `__` prefix as private,
 * so this is the public-routable mirror of /__test/sync).
 */
export default function SyncTestPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__drainQueue = drainQueue
      ;(window as unknown as Record<string, unknown>).__enqueuePhoto = enqueuePhoto
    }
  }, [])

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Sync Manager Test Harness</h1>
      <p className="text-sm text-muted-foreground">
        window.__drainQueue and __enqueuePhoto are exposed for Playwright.
      </p>
    </div>
  )
}
