import { getDb } from './db-core'
import type { ConflictRecord } from './db-schema'

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
