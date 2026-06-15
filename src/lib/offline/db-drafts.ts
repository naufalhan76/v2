import { getDb } from './db-core'
import type { DraftRecord } from './db-schema'

export async function putDraft(record: DraftRecord): Promise<void> {
  const db = await getDb()
  await db.put('drafts', record)
}

export async function getDraft(orderId: string): Promise<DraftRecord | undefined> {
  const db = await getDb()
  return db.get('drafts', orderId)
}

export async function deleteDraft(orderId: string): Promise<void> {
  const db = await getDb()
  await db.delete('drafts', orderId)
}
