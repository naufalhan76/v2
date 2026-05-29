/**
 * IndexedDB wrapper for the technician offline pipeline.
 *
 * Stores
 * ------
 *  - drafts            keyPath: orderId          → in-progress form state
 *  - pendingPhotos     keyPath: id (uuid)        → compressed Blob + metadata
 *  - pendingReports    keyPath: idempotencyKey   → ready-to-submit report
 *  - pendingTransitions keyPath: idempotencyKey  → queued status changes
 *  - conflicts         keyPath: id               → server-rejected payloads
 *
 * Why IndexedDB over localStorage:
 *   - Blobs survive serialization (photos/signature stay binary).
 *   - Async API doesn't block the main thread on quota checks.
 *   - Survives app restarts and tab close on iOS Safari.
 *
 * Schema is versioned via the DB_VERSION constant. Bump only when adding
 * stores or indexes — never repurpose an existing store name.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  TechnicianReportPayload,
  TechnicianTransitionPayload,
} from '@/app/api/schemas/technician'

export const DB_NAME = 'msn-technician'
export const DB_VERSION = 1

// =============================================================================
// Stored record shapes
// =============================================================================

export type DraftRecord = {
  orderId: string
  /** Arbitrary form state — opaque to the offline layer. */
  formState: Record<string, unknown>
  updatedAt: number
}

export type PhotoKind = 'before' | 'after' | 'signature'

export type PendingPhotoRecord = {
  /** UUID per photo — also used as the storage object name suffix. */
  id: string
  orderId: string
  /** Index of the AC unit within the report payload, or -1 for job-level. */
  acUnitIdx: number
  kind: PhotoKind
  /** Compressed JPEG blob ready to upload. */
  blob: Blob
  bytes: number
  width: number
  height: number
  mimeType: string
  /** Set after successful upload so retries skip already-uploaded photos. */
  uploadedPath: string | null
  /** ISO timestamp captured client-side. */
  capturedAt: string
  createdAt: number
}

export type PendingReportRecord = {
  /** UUID v4 — must match the value sent on the wire. */
  idempotencyKey: string
  orderId: string
  technicianId: string
  /** Photo IDs whose Blobs live in the pendingPhotos store. */
  photoIds: string[]
  /** Frozen payload draft. Photo URL fields are populated during sync. */
  payload: TechnicianReportPayload
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  createdAt: number
}

export type PendingTransitionRecord = {
  idempotencyKey: string
  orderId: string
  payload: TechnicianTransitionPayload
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  createdAt: number
}

export type ConflictKind = 'CANCELLED' | 'REASSIGNED' | 'AUTH' | 'OTHER'

export type ConflictRecord = {
  id: string
  orderId: string
  kind: ConflictKind
  /** Original payload preserved so the user can export it. */
  reportSnapshot: PendingReportRecord | null
  transitionSnapshot: PendingTransitionRecord | null
  serverMessage: string | null
  createdAt: number
}

// =============================================================================
// Schema typing for idb
// =============================================================================

interface TechnicianDB extends DBSchema {
  drafts: {
    key: string
    value: DraftRecord
  }
  pendingPhotos: {
    key: string
    value: PendingPhotoRecord
    indexes: {
      'by-order': string
    }
  }
  pendingReports: {
    key: string
    value: PendingReportRecord
    indexes: {
      'by-order': string
    }
  }
  pendingTransitions: {
    key: string
    value: PendingTransitionRecord
    indexes: {
      'by-order': string
    }
  }
  conflicts: {
    key: string
    value: ConflictRecord
    indexes: {
      'by-order': string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<TechnicianDB>> | null = null

/**
 * Lazily opens the technician IndexedDB. Safe to call from any client
 * component; throws if invoked in a non-browser environment.
 */
export function getDb(): Promise<IDBPDatabase<TechnicianDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in this runtime'))
  }
  if (!dbPromise) {
    dbPromise = openDB<TechnicianDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('drafts', { keyPath: 'orderId' })

          const photos = db.createObjectStore('pendingPhotos', {
            keyPath: 'id',
          })
          photos.createIndex('by-order', 'orderId')
          // TODO: remove unused 'by-uploaded' index in v2 migration for existing IDB instances.

          const reports = db.createObjectStore('pendingReports', {
            keyPath: 'idempotencyKey',
          })
          reports.createIndex('by-order', 'orderId')

          const transitions = db.createObjectStore('pendingTransitions', {
            keyPath: 'idempotencyKey',
          })
          transitions.createIndex('by-order', 'orderId')

          const conflicts = db.createObjectStore('conflicts', {
            keyPath: 'id',
          })
          conflicts.createIndex('by-order', 'orderId')
        }
      },
      blocked() {
        // Another tab is holding an old version. The user will see no
        // surface area until the other tab unblocks; this is rare in the
        // technician flow (single-tab usage).
      },
      blocking() {
        // We are blocking a newer version. Close so the upgrade can proceed.
        if (dbPromise) {
          dbPromise.then((db) => db.close()).catch(() => {})
          dbPromise = null
        }
      },
      terminated() {
        dbPromise = null
      },
    })
  }
  return dbPromise
}

// =============================================================================
// Draft operations
// =============================================================================

export async function putDraft(record: DraftRecord): Promise<void> {
  const db = await getDb()
  await db.put('drafts', record)
}

export async function getDraft(
  orderId: string
): Promise<DraftRecord | undefined> {
  const db = await getDb()
  return db.get('drafts', orderId)
}

export async function deleteDraft(orderId: string): Promise<void> {
  const db = await getDb()
  await db.delete('drafts', orderId)
}

// =============================================================================
// Pending photos
// =============================================================================

export async function putPhoto(record: PendingPhotoRecord): Promise<void> {
  const db = await getDb()
  await db.put('pendingPhotos', record)
}

export async function getPhoto(
  id: string
): Promise<PendingPhotoRecord | undefined> {
  const db = await getDb()
  return db.get('pendingPhotos', id)
}

export async function getPhotosForOrder(
  orderId: string
): Promise<PendingPhotoRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('pendingPhotos', 'by-order', orderId)
}

export async function markPhotoUploaded(
  id: string,
  uploadedPath: string
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('pendingPhotos', 'readwrite')
  const existing = await tx.store.get(id)
  if (existing) {
    existing.uploadedPath = uploadedPath
    await tx.store.put(existing)
  }
  await tx.done
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('pendingPhotos', id)
}

export async function deletePhotosForOrder(orderId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('pendingPhotos', 'readwrite')
  const index = tx.store.index('by-order')
  let cursor = await index.openCursor(orderId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

// =============================================================================
// Pending reports
// =============================================================================

export async function putReport(record: PendingReportRecord): Promise<void> {
  const db = await getDb()
  await db.put('pendingReports', record)
}

export async function getReport(
  idempotencyKey: string
): Promise<PendingReportRecord | undefined> {
  const db = await getDb()
  return db.get('pendingReports', idempotencyKey)
}

export async function getAllReports(): Promise<PendingReportRecord[]> {
  const db = await getDb()
  return db.getAll('pendingReports')
}

export async function deleteReport(idempotencyKey: string): Promise<void> {
  const db = await getDb()
  await db.delete('pendingReports', idempotencyKey)
}

// =============================================================================
// Pending transitions
// =============================================================================

export async function putTransition(
  record: PendingTransitionRecord
): Promise<void> {
  const db = await getDb()
  await db.put('pendingTransitions', record)
}

export async function getAllTransitions(): Promise<PendingTransitionRecord[]> {
  const db = await getDb()
  return db.getAll('pendingTransitions')
}

export async function deleteTransition(
  idempotencyKey: string
): Promise<void> {
  const db = await getDb()
  await db.delete('pendingTransitions', idempotencyKey)
}

// =============================================================================
// Conflicts
// =============================================================================

export async function putConflict(record: ConflictRecord): Promise<void> {
  const db = await getDb()
  await db.put('conflicts', record)
}

export async function getAllConflicts(): Promise<ConflictRecord[]> {
  const db = await getDb()
  return db.getAll('conflicts')
}

export async function deleteConflict(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('conflicts', id)
}

// =============================================================================
// Storage quota guard
// =============================================================================

export type QuotaInfo = {
  usage: number
  quota: number
  /** Fraction 0-1; null when the browser doesn't expose estimate. */
  ratio: number | null
}

export async function getQuotaInfo(): Promise<QuotaInfo | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return null
  }
  const est = await navigator.storage.estimate()
  const usage = est.usage ?? 0
  const quota = est.quota ?? 0
  return {
    usage,
    quota,
    ratio: quota > 0 ? usage / quota : null,
  }
}

/** Returns true if estimated usage exceeds 90% of the quota. */
export async function isQuotaCritical(): Promise<boolean> {
  const info = await getQuotaInfo()
  if (!info || info.ratio == null) return false
  return info.ratio > 0.9
}
