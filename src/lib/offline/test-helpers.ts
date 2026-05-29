/**
 * IDB inspector helpers for test harness pages.
 *
 * ONLY imported by pages under src/app/__test/* which are NODE_ENV-guarded.
 * Never import this file from production code.
 */

import { getDb, type PendingPhotoRecord, type PendingReportRecord } from './db'

// =============================================================================
// clearAllOfflineData
// =============================================================================

/**
 * Clears every store in the technician IndexedDB.
 * Use in test harness beforeEach / reset flows.
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(
    ['drafts', 'pendingPhotos', 'pendingReports', 'pendingTransitions', 'conflicts'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('drafts').clear(),
    tx.objectStore('pendingPhotos').clear(),
    tx.objectStore('pendingReports').clear(),
    tx.objectStore('pendingTransitions').clear(),
    tx.objectStore('conflicts').clear(),
  ])
  await tx.done
}

// =============================================================================
// seedFakeReport
// =============================================================================

/**
 * 1x1 transparent PNG as a base64 data URL — smallest valid PNG blob.
 * Used as a placeholder photo blob in test seeds.
 */
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function makeTinyBlob(): Blob {
  const binary = atob(TRANSPARENT_PNG_B64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}

/**
 * Inserts a minimal valid PendingReportRecord into IDB.
 * Optionally seeds N tiny placeholder PendingPhotoRecords.
 *
 * Returns the idempotencyKey so callers can reference the seeded record.
 */
export async function seedFakeReport(
  orderId: string,
  options?: { withPhotos?: number },
): Promise<{ idempotencyKey: string }> {
  const db = await getDb()

  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const now = Date.now()
  const isoNow = new Date(now).toISOString()

  // Seed photos first so photoIds can reference them.
  const photoIds: string[] = []
  const photoCount = options?.withPhotos ?? 0

  if (photoCount > 0) {
    const blob = makeTinyBlob()
    const photoTx = db.transaction('pendingPhotos', 'readwrite')
    for (let i = 0; i < photoCount; i++) {
      const photoId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `photo-${Date.now()}-${i}`
      const photo: PendingPhotoRecord = {
        id: photoId,
        orderId,
        acUnitIdx: -1,
        kind: 'before',
        blob,
        bytes: blob.size,
        width: 1,
        height: 1,
        mimeType: 'image/png',
        uploadedPath: null,
        capturedAt: isoNow,
        createdAt: now,
      }
      await photoTx.store.put(photo)
      photoIds.push(photoId)
    }
    await photoTx.done
  }

  const report: PendingReportRecord = {
    idempotencyKey,
    orderId,
    technicianId: 'test-technician-id',
    photoIds,
    payload: {
      idempotency_key: idempotencyKey,
      photos_before: ['placeholder-before.jpg'],
      photos_after: ['placeholder-after.jpg'],
      materials: [],
      actual_total_price: 0,
      customer_signature_url: 'placeholder-signature.png',
      customer_name_signed: 'Test Customer',
      notes: '',
      work_started_at: isoNow,
      work_completed_at: isoNow,
      next_service_recommendation_date: null,
      next_service_recommendation_notes: null,
      ac_units: [],
    },
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: now,
  }

  await db.put('pendingReports', report)

  return { idempotencyKey }
}

// =============================================================================
// dumpOfflineData
// =============================================================================

/**
 * Returns record counts per store — useful for assertions in test harness pages.
 */
export async function dumpOfflineData(): Promise<{
  drafts: number
  pendingPhotos: number
  pendingReports: number
  pendingTransitions: number
  conflicts: number
}> {
  const db = await getDb()
  const [drafts, pendingPhotos, pendingReports, pendingTransitions, conflicts] =
    await Promise.all([
      db.count('drafts'),
      db.count('pendingPhotos'),
      db.count('pendingReports'),
      db.count('pendingTransitions'),
      db.count('conflicts'),
    ])
  return { drafts, pendingPhotos, pendingReports, pendingTransitions, conflicts }
}
