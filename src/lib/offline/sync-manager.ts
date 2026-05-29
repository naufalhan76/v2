/**
 * Sync manager — orchestrates the IndexedDB outbox.
 *
 * Phase 1 (this file): minimal API surface used by the form layer (T8b).
 *   - enqueueReport(payload, photos)
 *   - enqueueTransition(payload)
 *   - drainQueue()       — drains pending queues with auth refresh + classifier.
 *
 * Phase 2 (Task 9): response classifier, idempotency-aware retry policy with
 * exponential backoff, conflict UI integration, photo upload pipeline,
 * `online`-event triggering.
 *
 * Wire format and idempotency keys are owned by the schemas in
 * `src/app/api/schemas/technician.ts` so the offline payload cannot drift
 * from the server contract.
 */

import {
  deletePhoto,
  deleteReport,
  deleteTransition,
  getAllReports,
  getAllTransitions,
  getDb,
  getPhoto,
  getPhotosForOrder,
  isQuotaCritical,
  markPhotoUploaded,
  putConflict,
  putPhoto,
  putReport,
  putTransition,
  type PendingPhotoRecord,
  type PendingReportRecord,
  type PendingTransitionRecord,
  type PhotoKind,
} from '@/lib/offline/db'
import type {
  TechnicianReportPayload,
  TechnicianTransitionPayload,
} from '@/app/api/schemas/technician'
import { refreshSession } from '@/lib/offline/auth-refresh'
import { offlineLogger } from './logger'
import { createClient } from '@/lib/supabase-browser'

// =============================================================================
// UUID v4 — small, dep-free.
// =============================================================================

export function newIdempotencyKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is required for idempotency keys')
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`
}

// =============================================================================
// Public enqueue API (consumed by the form)
// =============================================================================

export type EnqueuePhotoInput = {
  orderId: string
  acUnitIdx: number
  kind: PhotoKind
  blob: Blob
  bytes: number
  width: number
  height: number
  mimeType: string
  capturedAt?: string
}

export async function enqueuePhoto(
  input: EnqueuePhotoInput
): Promise<PendingPhotoRecord> {
  if (await isQuotaCritical()) {
    throw new Error(
      'STORAGE_QUOTA_CRITICAL: storage almost full — sync existing drafts first'
    )
  }
  const record: PendingPhotoRecord = {
    id: newIdempotencyKey(),
    orderId: input.orderId,
    acUnitIdx: input.acUnitIdx,
    kind: input.kind,
    blob: input.blob,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
    mimeType: input.mimeType,
    uploadedPath: null,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    createdAt: Date.now(),
  }
  await putPhoto(record)
  return record
}

export type EnqueueReportInput = {
  orderId: string
  technicianId: string
  payload: TechnicianReportPayload
  photoIds: string[]
}

export async function enqueueReport(
  input: EnqueueReportInput
): Promise<PendingReportRecord> {
  const record: PendingReportRecord = {
    idempotencyKey: input.payload.idempotency_key,
    orderId: input.orderId,
    technicianId: input.technicianId,
    photoIds: input.photoIds,
    payload: input.payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
  }
  await putReport(record)
  await requestBackgroundSync('msn-tech-sync-reports')
  return record
}

export async function enqueueTransition(
  orderId: string,
  payload: TechnicianTransitionPayload
): Promise<PendingTransitionRecord> {
  if (!payload.idempotency_key) {
    throw new Error('enqueueTransition: idempotency_key is required')
  }
  const record: PendingTransitionRecord = {
    idempotencyKey: payload.idempotency_key,
    orderId,
    payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
  }
  await putTransition(record)
  await requestBackgroundSync('msn-tech-sync-transitions')
  return record
}

// =============================================================================
// SW bridge
// =============================================================================

async function requestBackgroundSync(tag: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const reg = await navigator.serviceWorker.ready
    // Browsers without Background Sync (iOS) ignore this — useOnlineSync hook
    // is the iOS path.
    if (reg.active) {
      reg.active.postMessage({ type: 'REGISTER_SYNC', tag })
    }
  } catch {
    // No-op; the online-event listener will still drive the queue.
  }
}

// =============================================================================
// Internal helpers (Task 9)
// =============================================================================

/**
 * Exponential backoff delay in ms for a given attempt count.
 * Steps: 0, 1 s, 5 s, 30 s, 2 min, 10 min (capped at index 5).
 */
function backoffMs(n: number): number {
  const steps = [0, 1000, 5000, 30000, 120000, 600000]
  return steps[Math.min(n, steps.length - 1)]
}

/**
 * Upload a single photo blob to Supabase Storage.
 * Idempotent: if record.uploadedPath is already set, returns it immediately.
 * Throws on upload error.
 */
async function uploadPhotoBlob(record: PendingPhotoRecord): Promise<string> {
  if (record.uploadedPath) return record.uploadedPath

  const bucket = record.kind === 'signature' ? 'signatures' : 'service-photos'
  const ext = record.mimeType.split('/')[1] || 'jpg'
  const path = `${record.orderId}/${record.id}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, record.blob, { contentType: record.mimeType, upsert: true })

  if (error) throw new Error(`Photo upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  await markPhotoUploaded(record.id, publicUrl)
  return publicUrl
}

type ClassifyResult =
  | 'success'
  | 'idempotent'
  | 'conflict-cancelled'
  | 'auth-fail'
  | 'retry'
  | 'permanent-fail'

/**
 * Classify an HTTP response into a sync outcome.
 * Clones the response before reading the body so the original remains readable.
 */
async function classifyResponse(res: Response): Promise<ClassifyResult> {
  if (res.ok) {
    const cloned = res.clone()
    const body = await cloned.json().catch(() => ({}))
    return body.idempotent_replay ? 'idempotent' : 'success'
  }

  if (res.status === 401) return 'auth-fail'

  if (res.status === 409 || res.status === 422) {
    const cloned = res.clone()
    const body = await cloned.json().catch(() => ({}))
    const msg: string = body.error ?? body.message ?? ''
    return /cancel|reassign/i.test(msg) ? 'conflict-cancelled' : 'permanent-fail'
  }

  if (res.status >= 500) return 'retry'

  return 'permanent-fail'
}

// =============================================================================
// Drain — real implementation (Task 9)
// =============================================================================

export type DrainResult = {
  reportsAttempted: number
  transitionsAttempted: number
  reportsSynced: number
  transitionsSynced: number
  errors: Array<{ kind: 'report' | 'transition'; key: string; message: string }>
}

let draining = false

/**
 * Drain pending queues. Returns counts so the UI can surface progress.
 * Safe to call concurrently — a mutex prevents overlap.
 *
 * Flow:
 *  1. Refresh auth session — abort early if no valid session.
 *  2. Process transitions with backoff + response classification.
 *  3. Upload photos then POST reports with backoff + classification.
 */
export async function drainQueue(): Promise<DrainResult> {
  const result: DrainResult = {
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
    const auth = await refreshSession()
    offlineLogger.info('drain auth', { ok: auth.ok, reason: auth.ok ? null : auth.reason })
    if (!auth.ok) {
      result.errors.push({
        kind: 'transition',
        key: 'AUTH',
        message: `AUTH_REQUIRED: ${auth.message}`,
      })
      return result
    }

    // ------------------------------------------------------------------
    // 2. Transitions
    // ------------------------------------------------------------------
    const [reports, transitions] = await Promise.all([
      getAllReports(),
      getAllTransitions(),
    ])

    result.reportsAttempted = reports.length
    result.transitionsAttempted = transitions.length

    for (const record of transitions) {
      const now = Date.now()
      const lastAttempt = record.lastAttemptAt ?? 0
      if (lastAttempt + backoffMs(record.attempts) > now) continue

      let res: Response | null = null
      let classify: ClassifyResult = 'retry'

      try {
        res = await fetch(`/api/technician/jobs/${encodeURIComponent(record.orderId)}/transition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record.payload),
        })
        classify = await classifyResponse(res)
      } catch {
        classify = 'retry'
      }

      if (classify === 'success' || classify === 'idempotent') {
        await deleteTransition(record.idempotencyKey)
        result.transitionsSynced++
      } else if (classify === 'retry') {
        await putTransition({
          ...record,
          attempts: record.attempts + 1,
          lastAttemptAt: Date.now(),
          lastError: res ? `HTTP ${res.status}` : 'network error',
        })
      } else if (classify === 'conflict-cancelled') {
        const cloned = res ? res.clone() : null
        const body = cloned ? await cloned.json().catch(() => ({})) : {}
        await putConflict({
          id: newIdempotencyKey(),
          orderId: record.orderId,
          kind: 'CANCELLED',
          reportSnapshot: null,
          transitionSnapshot: record,
          serverMessage: body.error ?? body.message ?? null,
          createdAt: Date.now(),
        })
        await deleteTransition(record.idempotencyKey)
      } else if (classify === 'auth-fail') {
        result.errors.push({
          kind: 'transition',
          key: record.idempotencyKey,
          message: 'AUTH_REQUIRED: session expired during sync',
        })
      } else {
        // permanent-fail
        result.errors.push({
          kind: 'transition',
          key: record.idempotencyKey,
          message: res ? `HTTP ${res.status}` : 'permanent failure',
        })
        await deleteTransition(record.idempotencyKey)
      }
    }

    // ------------------------------------------------------------------
    // 3. Reports
    // ------------------------------------------------------------------
    for (const record of reports) {
      const now = Date.now()
      const lastAttempt = record.lastAttemptAt ?? 0
      if (lastAttempt + backoffMs(record.attempts) > now) continue

      // Upload photos first
      let photoFailed = false
      const uploadedUrls: Record<string, string> = {}

      for (const photoId of record.photoIds) {
        const photoRecord = await getPhoto(photoId)
        if (!photoRecord) continue
        try {
          const url = await uploadPhotoBlob(photoRecord)
          uploadedUrls[photoId] = url
        } catch {
          photoFailed = true
          break
        }
      }

      if (photoFailed) {
        await putReport({
          ...record,
          attempts: record.attempts + 1,
          lastAttemptAt: Date.now(),
          lastError: 'photo upload failed',
        })
        continue
      }

      // Build patched payload with uploaded URLs
      const patchedPayload: TechnicianReportPayload = { ...record.payload }

      // Collect photo records by id for easy lookup
      const photoRecordMap: Record<string, PendingPhotoRecord> = {}
      for (const photoId of record.photoIds) {
        const pr = await getPhoto(photoId)
        if (pr) photoRecordMap[photoId] = pr
      }

      // Job-level photos (acUnitIdx === -1)
      const jobBefore: string[] = []
      const jobAfter: string[] = []
      let signatureUrl: string | null = null

      for (const photoId of record.photoIds) {
        const pr = photoRecordMap[photoId]
        if (!pr) continue
        const url = uploadedUrls[photoId] ?? pr.uploadedPath
        if (!url) continue
        if (pr.acUnitIdx === -1) {
          if (pr.kind === 'before') jobBefore.push(url)
          else if (pr.kind === 'after') jobAfter.push(url)
          else if (pr.kind === 'signature') signatureUrl = url
        }
      }

      if (jobBefore.length > 0) patchedPayload.photos_before = jobBefore
      if (jobAfter.length > 0) patchedPayload.photos_after = jobAfter
      if (signatureUrl) patchedPayload.customer_signature_url = signatureUrl

      // Per-AC photos
      if (patchedPayload.ac_units && patchedPayload.ac_units.length > 0) {
        patchedPayload.ac_units = patchedPayload.ac_units.map((unit, idx) => {
          const acBefore: string[] = []
          const acAfter: string[] = []
          for (const photoId of record.photoIds) {
            const pr = photoRecordMap[photoId]
            if (!pr || pr.acUnitIdx !== idx) continue
            const url = uploadedUrls[photoId] ?? pr.uploadedPath
            if (!url) continue
            if (pr.kind === 'before') acBefore.push(url)
            else if (pr.kind === 'after') acAfter.push(url)
          }
          return {
            ...unit,
            ...(acBefore.length > 0 ? { photos_before: acBefore } : {}),
            ...(acAfter.length > 0 ? { photos_after: acAfter } : {}),
          }
        })
      }

      let res: Response | null = null
      let classify: ClassifyResult = 'retry'

      try {
        res = await fetch(`/api/technician/jobs/${encodeURIComponent(record.orderId)}/report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patchedPayload),
        })
        classify = await classifyResponse(res)
      } catch {
        classify = 'retry'
      }

      if (classify === 'success' || classify === 'idempotent') {
        await cleanupAfterSync(record.orderId)
        result.reportsSynced++
      } else if (classify === 'retry') {
        await putReport({
          ...record,
          attempts: record.attempts + 1,
          lastAttemptAt: Date.now(),
          lastError: res ? `HTTP ${res.status}` : 'network error',
        })
      } else if (classify === 'conflict-cancelled') {
        const cloned = res ? res.clone() : null
        const body = cloned ? await cloned.json().catch(() => ({})) : {}
        await putConflict({
          id: newIdempotencyKey(),
          orderId: record.orderId,
          kind: 'CANCELLED',
          reportSnapshot: record,
          transitionSnapshot: null,
          serverMessage: body.error ?? body.message ?? null,
          createdAt: Date.now(),
        })
        // Keep photos for export — do NOT delete photos here
        await deleteReport(record.idempotencyKey)
      } else if (classify === 'auth-fail') {
        result.errors.push({
          kind: 'report',
          key: record.idempotencyKey,
          message: 'AUTH_REQUIRED: session expired during sync',
        })
      } else {
        // permanent-fail
        result.errors.push({
          kind: 'report',
          key: record.idempotencyKey,
          message: res ? `HTTP ${res.status}` : 'permanent failure',
        })
        await deleteReport(record.idempotencyKey)
      }
    }

    return result
  } finally {
    draining = false
  }
}

// =============================================================================
// Cleanup helpers (used after successful sync — wired in Task 9)
// =============================================================================

export async function cleanupAfterSync(orderId: string): Promise<void> {
  const photos = await getPhotosForOrder(orderId)
  await Promise.all(photos.map((p) => deletePhoto(p.id)))
  const reports = await getAllReports()
  await Promise.all(
    reports
      .filter((r) => r.orderId === orderId)
      .map((r) => deleteReport(r.idempotencyKey))
  )
  const transitions = await getAllTransitions()
  await Promise.all(
    transitions
      .filter((t) => t.orderId === orderId)
      .map((t) => deleteTransition(t.idempotencyKey))
  )
}

export async function getPendingCount(): Promise<{
  reports: number
  transitions: number
  photos: number
}> {
  const db = await getDb()
  const [r, t, p] = await Promise.all([
    db.count('pendingReports'),
    db.count('pendingTransitions'),
    db.count('pendingPhotos'),
  ])
  return { reports: r, transitions: t, photos: p }
}
