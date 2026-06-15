/**
 * Pending transition CRUD operations.
 */

import { getDb } from './db-core'
import type { PendingTransitionRecord } from './db-schema'

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
