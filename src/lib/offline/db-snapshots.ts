import { getDb } from './db-core'
import type { LocalJobSnapshot } from './db-schema'

export async function putSnapshot(record: LocalJobSnapshot): Promise<void> {
  const db = await getDb()
  await db.put('jobSnapshots', record)
}

export async function getSnapshot(orderId: string): Promise<LocalJobSnapshot | undefined> {
  const db = await getDb()
  return db.get('jobSnapshots', orderId)
}

export async function getAllSnapshots(): Promise<LocalJobSnapshot[]> {
  const db = await getDb()
  return db.getAll('jobSnapshots')
}

export async function deleteSnapshot(orderId: string): Promise<void> {
  const db = await getDb()
  await db.delete('jobSnapshots', orderId)
}

export async function lockSnapshot(orderId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('jobSnapshots', 'readwrite')
  const existing = await tx.store.get(orderId)
  if (existing) {
    existing.locked = true
    await tx.store.put(existing)
  }
  await tx.done
}

export async function unlockSnapshot(orderId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('jobSnapshots', 'readwrite')
  const existing = await tx.store.get(orderId)
  if (existing) {
    existing.locked = false
    await tx.store.put(existing)
  }
  await tx.done
}
