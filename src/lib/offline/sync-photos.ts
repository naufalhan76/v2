/**
 * Sync photos — photo enqueue + upload helpers.
 */

import {
  isQuotaCritical,
  markPhotoUploaded,
  putPhoto,
  type PendingPhotoRecord,
  type PhotoKind,
} from './db'
import { newIdempotencyKey } from './idempotency'

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

/**
 * Upload a single photo blob to Supabase Storage via signed upload URL.
 * Idempotent: if record.uploadedPath is already set, returns it immediately.
 * Throws on upload error.
 */
export async function uploadPhotoBlob(record: PendingPhotoRecord): Promise<string> {
  if (record.uploadedPath) return record.uploadedPath

  const bucket = record.kind === 'signature' ? 'signatures' : 'service-photos'
  const rawExt = record.mimeType.split('/')[1] || 'jpg'
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
  // orderId format is REQ/YYYY-MM/NNNNNN — sanitize slashes for safe path segments
  const path = `${record.orderId.replace(/\//g, '-')}/${record.id}.${ext}`

  const signRes = await fetch('/api/photos/signed-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}))
    throw new Error(`Failed to get signed upload URL: ${body.error || signRes.statusText}`)
  }
  const { signedUrl } = await signRes.json()

  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    body: record.blob,
    headers: { 'Content-Type': record.mimeType },
  })
  if (!uploadRes.ok) {
    throw new Error(`Photo upload failed: ${uploadRes.statusText}`)
  }

  // Store the storage path (not a full URL) so server-side can create
  // signed URLs for both public and private buckets.
  const storagePath = `${bucket}/${path}`
  await markPhotoUploaded(record.id, storagePath)
  return storagePath
}
