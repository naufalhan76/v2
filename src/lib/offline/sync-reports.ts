/**
 * Sync reports — enqueue + drain logic for service reports with photo upload.
 */

import {
  deletePhoto,
  deleteReport,
  getAllReports,
  getPhoto,
  getPhotosForOrder,
  putConflict,
  putReport,
  type PendingPhotoRecord,
  type PendingReportRecord,
} from './db'
import { newIdempotencyKey } from './idempotency'
import { uploadPhotoBlob } from './sync-photos'
import { backoffMs, classifyResponse, type ClassifyResult } from './sync-utils'
import type { TechnicianReportPayload } from '@/app/api/schemas/technician'
import { normalizeTechnicianReportPayload } from '@/app/api/schemas/technician'

export type EnqueueReportInput = {
  orderId: string
  technicianId: string
  payload: TechnicianReportPayload
  photoIds: string[]
}

export async function enqueueReport(
  input: EnqueueReportInput
): Promise<PendingReportRecord> {
  const payload = normalizeTechnicianReportPayload(input.payload)
  const record: PendingReportRecord = {
    idempotencyKey: payload.idempotency_key,
    orderId: input.orderId,
    technicianId: input.technicianId,
    photoIds: input.photoIds,
    payload,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    status: 'pending',
    createdAt: Date.now(),
  }
  await putReport(record)
  await requestBackgroundSync('msn-tech-sync-reports')
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await drainReports(await getAllReports(), { bypassBackoff: true }, { synced: 0, errors: [] })
  }
  return record
}

async function requestBackgroundSync(tag: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.active) {
      reg.active.postMessage({ type: 'REGISTER_SYNC', tag })
    }
  } catch {
    // No-op
  }
}

type ReportDrainContext = {
  synced: number
  errors: Array<{ kind: 'report' | 'transition'; key: string; message: string; status?: PendingReportRecord['status'] }>
}

/**
 * Drain pending reports: upload photos, POST payloads, handle responses.
 */
export async function drainReports(
  reports: PendingReportRecord[],
  options: { bypassBackoff?: boolean },
  result: ReportDrainContext,
): Promise<ReportDrainContext> {
  for (const record of reports) {
    const now = Date.now()
    const lastAttempt = record.lastAttemptAt ?? 0
    if (!options.bypassBackoff && lastAttempt + backoffMs(record.attempts) > now) continue

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
        status: 'pending',
      })
      result.errors.push({
        kind: 'report',
        key: record.idempotencyKey,
        message: 'photo upload failed',
        status: 'pending',
      })
      continue
    }

    // Build patched payload with uploaded URLs
    const patchedPayload: TechnicianReportPayload = { ...record.payload }
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

    if (signatureUrl) patchedPayload.customer_signature_url = signatureUrl

    // Per-AC photos — also flattened into top-level arrays.
    // ponytail: the app only takes per-AC photos (acUnitIdx >= 0), but the
    // RPC stores photos_before/photos_after as TEXT[] on service_reports and
    // the dashboard reads those columns. Without flattening, those columns
    // stay empty. Upgrade path: make dashboard read ac_units JSONB directly.
    const allBefore: string[] = [...jobBefore]
    const allAfter: string[] = [...jobAfter]

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
        allBefore.push(...acBefore)
        allAfter.push(...acAfter)
        return {
          ...unit,
          ...(acBefore.length > 0 ? { photos_before: acBefore } : {}),
          ...(acAfter.length > 0 ? { photos_after: acAfter } : {}),
        }
      })
    }

    patchedPayload.photos_before = allBefore
    patchedPayload.photos_after = allAfter

    let res: Response | null = null
    let classify: ClassifyResult = { action: 'retry', message: null }

    try {
      res = await fetch(`/api/technician/jobs/${encodeURIComponent(record.orderId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchedPayload),
      })
      classify = await classifyResponse(res)
    } catch {
      classify = { action: 'retry', message: null }
    }

    if (classify.action === 'success' || classify.action === 'idempotent') {
      await cleanupAfterSync(record.orderId)
      result.synced++
    } else if (classify.action === 'retry') {
      await putReport({
        ...record,
        attempts: record.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: res ? `HTTP ${res.status}` : 'network error',
        status: 'pending',
      })
    } else if (classify.action === 'conflict-cancelled') {
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
      await deleteReport(record.idempotencyKey)
    } else if (classify.action === 'auth-fail') {
      result.errors.push({
        kind: 'report',
        key: record.idempotencyKey,
        message: 'AUTH_REQUIRED: session expired during sync',
      })
    } else if (classify.action === 'needs-attention') {
      const message = classify.message ?? (res ? `HTTP ${res.status}` : 'needs attention')
      const prefix = classify.status === 'auth-error' ? 'AUTH_ERROR' : 'NEEDS_ATTENTION'
      await putReport({
        ...record,
        attempts: record.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: message,
        status: classify.status,
      })
      result.errors.push({
        kind: 'report',
        key: record.idempotencyKey,
        message: `${prefix}: ${message}`,
        status: classify.status,
      })
    } else {
      result.errors.push({
        kind: 'report',
        key: record.idempotencyKey,
        message: classify.message ?? (res ? `HTTP ${res.status}` : 'permanent failure'),
      })
      await deleteReport(record.idempotencyKey)
    }
  }

  return result
}

/**
 * Cleanup after successful sync: delete photos, reports, and transitions for an order.
 */
export async function cleanupAfterSync(orderId: string): Promise<void> {
  const photos = await getPhotosForOrder(orderId)
  await Promise.all(photos.map((p) => deletePhoto(p.id)))
  const reports = await getAllReports()
  const reportDeletions = []
  for (const report of reports) {
    if (report.orderId === orderId) reportDeletions.push(deleteReport(report.idempotencyKey))
  }
  await Promise.all(reportDeletions)
  const { getAllTransitions, deleteTransition } = await import('./db')
  const transitions = await getAllTransitions()
  const transitionDeletions = []
  for (const transition of transitions) {
    if (transition.orderId === orderId) transitionDeletions.push(deleteTransition(transition.idempotencyKey))
  }
  await Promise.all(transitionDeletions)
}
