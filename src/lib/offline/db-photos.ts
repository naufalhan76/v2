/**
 * Pending photo CRUD operations.
 */

import { getDb } from './db-core'
import type { PendingPhotoRecord, PhotoKind } from './db-schema'

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

export type { PendingPhotoRecord, PhotoKind }
