/**
 * Pending report CRUD operations.
 */

import { getDb } from './db-core'
import type { PendingReportRecord } from './db-schema'

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
