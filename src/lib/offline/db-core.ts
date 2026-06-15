/**
 * Internal — opens the technician IndexedDB.
 * Import this from sibling CRUD modules; consumers should use `./db`.
 */

import { openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, type TechnicianDB } from './db-schema'

let dbPromise: Promise<IDBPDatabase<TechnicianDB>> | null = null

export function getDb(): Promise<IDBPDatabase<TechnicianDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in this runtime'))
  }
  if (!dbPromise) {
    dbPromise = openDB<TechnicianDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('drafts', { keyPath: 'orderId' })

          const photos = db.createObjectStore('pendingPhotos', { keyPath: 'id' })
          photos.createIndex('by-order', 'orderId')

          const reports = db.createObjectStore('pendingReports', { keyPath: 'idempotencyKey' })
          reports.createIndex('by-order', 'orderId')

          const transitions = db.createObjectStore('pendingTransitions', { keyPath: 'idempotencyKey' })
          transitions.createIndex('by-order', 'orderId')

          const conflicts = db.createObjectStore('conflicts', { keyPath: 'id' })
          conflicts.createIndex('by-order', 'orderId')
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('jobSnapshots')) {
            db.createObjectStore('jobSnapshots', { keyPath: 'orderId' })
          }
        }
      },
      blocked() {},
      blocking() {
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
