/**
 * Sync manager — orchestrator for the IndexedDB outbox.
 *
 * Re-exports domain modules:
 *  - sync-photos.ts   → enqueuePhoto, uploadPhotoBlob
 *  - sync-reports.ts  → enqueueReport, cleanupAfterSync
 *  - sync-transitions → enqueueTransition
 *  - idempotency.ts   → newIdempotencyKey
 *  - sync-utils.ts    → backoffMs, classifyResponse, ClassifyResult
 *
 * Own concerns:
 *  - drainQueue()     → auth + transitions + reports orchestration
 *  - getPendingCount() → counts for UI
 *  - types: Drain Result, DrainQueueOptions
 */

export { enqueuePhoto, type EnqueuePhotoInput } from './sync-photos'
export { enqueueReport, type EnqueueReportInput, cleanupAfterSync } from './sync-reports'
export { enqueueTransition } from './sync-transitions'
export { newIdempotencyKey } from './idempotency'
export { backoffMs, classifyResponse, type ClassifyResult } from './sync-utils'
export type { DrainQueueOptions, DrainResult } from './sync-types'

import {
  getAllReports,
  getAllTransitions,
  getDb,
  type PendingReportStatus,
} from './db'
import { offlineLogger } from './logger'
import { drainTransitions } from './sync-transitions'
import { drainReports } from './sync-reports'
import type { DrainQueueOptions } from './sync-types'

// Re-use DrainResult type locally to avoid import/export conflict
type LocalDrainResult = {
  reportsAttempted: number
  transitionsAttempted: number
  reportsSynced: number
  transitionsSynced: number
  errors: Array<{
    kind: 'report' | 'transition'
    key: string
    message: string
    status?: PendingReportStatus
  }>
}

let draining = false

export async function drainQueue(options: DrainQueueOptions = {}): Promise<LocalDrainResult> {
  const result: LocalDrainResult = {
    reportsAttempted: 0,
    transitionsAttempted: 0,
    reportsSynced: 0,
    transitionsSynced: 0,
    errors: [],
  }

  if (draining) return result
  draining = true

  try {
    // ------------------------------------------------------------------
    // 1. Auth check
    // ------------------------------------------------------------------
    const clerkToken = await (window as unknown as Record<string, { session?: { getToken(): Promise<string | null> } }>).Clerk?.session?.getToken() ?? null
    const authOk = !!clerkToken
    offlineLogger.info('drain auth', { ok: authOk, reason: authOk ? null : 'no-session' })
    if (!authOk) {
      result.errors.push({
        kind: 'transition',
        key: 'AUTH',
        message: 'AUTH_REQUIRED: No active Clerk session',
      })
      return result
    }

    // ------------------------------------------------------------------
    // 2. Fetch queues
    // ------------------------------------------------------------------
    const [reports, transitions] = await Promise.all([
      getAllReports(),
      getAllTransitions(),
    ])

    result.reportsAttempted = reports.length
    result.transitionsAttempted = transitions.length

    // ------------------------------------------------------------------
    // 3. Transitions
    // ------------------------------------------------------------------
    const transResult = await drainTransitions(transitions, options)
    result.transitionsSynced = transResult.synced
    result.errors.push(...transResult.errors as LocalDrainResult['errors'])

    // ------------------------------------------------------------------
    // 4. Reports
    // ------------------------------------------------------------------
    const reportContext = { synced: 0, errors: [] as LocalDrainResult['errors'] }
    await drainReports(reports, options, reportContext)
    result.reportsSynced = reportContext.synced
    result.errors.push(...reportContext.errors)

    return result
  } finally {
    draining = false
  }
}

export async function getPendingCount(): Promise<{
  reports: number
  transitions: number
  photos: number
  needsAttention: number
}> {
  const db = await getDb()
  const [reports, transitions, photos, reportRecords] = await Promise.all([
    db.count('pendingReports'),
    db.count('pendingTransitions'),
    db.count('pendingPhotos'),
    getAllReports(),
  ])
  const needsAttention = reportRecords.filter(
    (report) => report.status === 'needs-attention' || report.status === 'auth-error'
  ).length
  return { reports, transitions, photos, needsAttention }
}
