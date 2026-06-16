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
import { createClient } from '@/lib/supabase-browser'

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
 * Upload a single photo blob to Supabase Storage.
 * Idempotent: if record.uploadedPath is already set, returns it immediately.
 * Throws on upload error.
 */
export async function uploadPhotoBlob(record: PendingPhotoRecord): Promise<string> {
  if (record.uploadedPath) return record.uploadedPath

  const bucket = record.kind === 'signature' ? 'signatures' : 'service-photos'
  const ext = record.mimeType.split('/')[1] || 'jpg'
  const path = `${record.orderId}/${record.id}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, record.blob, { contentType: record.mimeType, upsert: true })

  if (error) throw new Error(`Photo upload failed: ${error.message}`)

  let url: string
  if (bucket === 'service-photos') {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300)
    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message ?? 'unknown'}`)
    }
    url = signedData.signedUrl
  } else {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
    url = urlData.publicUrl
  }

  await markPhotoUploaded(record.id, url)
  return url
}
