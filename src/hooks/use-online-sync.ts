/**
 * useOnlineSync — React hook that drains the offline queue when the browser
 * regains connectivity.
 *
 * Triggers in priority order:
 *   1. window 'online' event              → primary path (works on iOS Safari)
 *   2. service worker SYNC_REQUEST msg    → Chromium Background Sync wakeup
 *   3. visibilitychange (visible)         → user returns to a backgrounded tab
 *   4. mount-time check                   → drain whatever's already queued
 *
 * Component contract:
 *   const { isOnline, syncing, pending, lastResult, syncNow } = useOnlineSync()
 *
 * The hook does not read auth state directly — `drainQueue()` (Task 9) will
 * call `refreshSession()` itself before any network calls.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  drainQueue,
  getPendingCount,
  type DrainResult,
} from '@/lib/offline/sync-manager'

export type UseOnlineSyncState = {
  isOnline: boolean
  syncing: boolean
  pending: { reports: number; transitions: number; photos: number; needsAttention: number }
  lastResult: DrainResult | null
  errors: DrainResult['errors']
  needsAttention: number
  lastError: string | null
  syncNow: (options?: { bypassBackoff?: boolean }) => Promise<void>
}

const ZERO_PENDING = { reports: 0, transitions: 0, photos: 0, needsAttention: 0 }

export function useOnlineSync(): UseOnlineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState(ZERO_PENDING)
  const [lastResult, setLastResult] = useState<DrainResult | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  // Mutex flag — surface to React when sync starts/ends without re-running
  // the drain on every state change.
  const inFlight = useRef(false)

  const refreshPending = useCallback(async () => {
    try {
      const counts = await getPendingCount()
      setPending(counts)
    } catch {
      // IDB might not be ready yet — try again on the next tick.
    }
  }, [])

  const syncNow = useCallback(async (options: { bypassBackoff?: boolean } = {}) => {
    if (inFlight.current) return
    inFlight.current = true
    setSyncing(true)
    setLastError(null)
    try {
      const result = await drainQueue(options)
      setLastResult(result)
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlight.current = false
      setSyncing(false)
      void refreshPending()
    }
  }, [refreshPending])

  // Mount: prime pending count + opportunistic drain if online.
  useEffect(() => {
    void refreshPending()
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void syncNow()
    }
  }, [refreshPending, syncNow])

  // online / offline events.
  useEffect(() => {
    function onOnline() {
      setIsOnline(true)
      void syncNow()
    }
    function onOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncNow])

  // SW message bridge — Chromium Background Sync nudges us through the SW.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } | null
      if (data && data.type === 'SYNC_REQUEST') {
        void syncNow()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [syncNow])

  // visibilitychange — user came back to the tab.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () =>
      document.removeEventListener('visibilitychange', onVisibility)
  }, [syncNow])

  return {
    isOnline,
    syncing,
    pending,
    lastResult,
    errors: lastResult?.errors ?? [],
    needsAttention: pending.needsAttention,
    lastError,
    syncNow,
  }
}
