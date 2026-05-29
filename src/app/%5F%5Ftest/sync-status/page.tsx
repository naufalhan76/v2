'use client'

import * as React from 'react'
import { SyncStatus } from '@/components/technician/sync-status'
import { putReport, PendingReportRecord, getDb } from '@/lib/offline/db'

export default function SyncStatusHarness() {
  const toggleOnline = () => {
    if (navigator.onLine) {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      window.dispatchEvent(new Event('offline'))
    } else {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
      window.dispatchEvent(new Event('online'))
    }
  }

  const addPending = async () => {
    const record: PendingReportRecord = {
      idempotencyKey: 'test-' + Date.now(),
      orderId: 'order-123',
      technicianId: 'tech-123',
      photoIds: [],
      payload: {} as any,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: Date.now()
    }
    await putReport(record)
    // To trigger an update in the hook since we bypassed the sync manager
    window.dispatchEvent(new Event('online'))
  }

  const triggerError = () => {
    // Left unimplemented
  }

  const clearAll = async () => {
    const db = await getDb()
    const tx = db.transaction(['pendingReports', 'pendingTransitions', 'pendingPhotos'], 'readwrite')
    await Promise.all([
      tx.objectStore('pendingReports').clear(),
      tx.objectStore('pendingTransitions').clear(),
      tx.objectStore('pendingPhotos').clear()
    ])
    await tx.done
    window.dispatchEvent(new Event('online'))
  }

  return (
    <div className="p-8 space-y-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Sync Status Harness</h1>
      
      <div className="flex gap-4 p-4 border rounded-lg bg-card">
        <SyncStatus variant="full" />
        <SyncStatus variant="compact" />
      </div>

      <div className="flex flex-col gap-2">
        <button id="btn-toggle-online" className="px-4 py-2 bg-secondary rounded" onClick={toggleOnline}>
          Toggle online
        </button>
        <button id="btn-add-pending" className="px-4 py-2 bg-secondary rounded" onClick={addPending}>
          Add 1 pending report
        </button>
        <button id="btn-trigger-error" className="px-4 py-2 bg-secondary rounded" onClick={triggerError}>
          Trigger error
        </button>
        <button id="btn-clear" className="px-4 py-2 bg-secondary rounded" onClick={clearAll}>
          Clear all
        </button>
      </div>
    </div>
  )
}
