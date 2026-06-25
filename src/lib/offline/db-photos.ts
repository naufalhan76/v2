/**
 * Pending photo CRUD operations.
 */

import { getDb } from './db-core'
import { getAllReports } from './db-reports'
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

export async function getAllPhotos(): Promise<PendingPhotoRecord[]> {
  const db = await getDb()
  const all = await db.getAll('pendingPhotos')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getStuckPhotoCount(): Promise<number> {
  const [photos, reports] = await Promise.all([getAllPhotos(), getAllReports()])
  const referencedIds = new Set<string>()
  for (const report of reports) {
    for (const photoId of report.photoIds) {
      referencedIds.add(photoId)
    }
  }
  return photos.filter(
    (photo) => photo.uploadedPath === null && !referencedIds.has(photo.id)
  ).length
}

export async function deleteStuckPhotos(): Promise<number> {
  const [photos, reports] = await Promise.all([getAllPhotos(), getAllReports()])
  const referencedIds = new Set<string>()
  for (const report of reports) {
    for (const photoId of report.photoIds) {
      referencedIds.add(photoId)
    }
  }
  const stuck = photos.filter(
    (photo) => photo.uploadedPath === null && !referencedIds.has(photo.id)
  )
  if (stuck.length === 0) return 0

  const db = await getDb()
  const tx = db.transaction('pendingPhotos', 'readwrite')
  for (const photo of stuck) {
    await tx.store.delete(photo.id)
  }
  await tx.done
  return stuck.length
}

export type { PendingPhotoRecord, PhotoKind }
