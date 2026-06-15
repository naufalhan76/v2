/**
 * IndexedDB schema: type definitions, store names, and DB constants.
 */

import { openDB, type DBSchema } from 'idb'
import type {
  TechnicianReportPayload,
  TechnicianTransitionPayload,
} from '@/app/api/schemas/technician'

export const DB_NAME = 'msn-technician'
export const DB_VERSION = 2

// =============================================================================
// Stored record shapes
// =============================================================================

export type DraftRecord = {
  orderId: string
  formState: Record<string, unknown>
  updatedAt: number
}

export type PhotoKind = 'before' | 'after' | 'signature'

export type PendingPhotoRecord = {
  id: string
  orderId: string
  acUnitIdx: number
  kind: PhotoKind
  blob: Blob
  bytes: number
  width: number
  height: number
  mimeType: string
  uploadedPath: string | null
  capturedAt: string
  createdAt: number
}

export type PendingReportStatus = 'pending' | 'needs-attention' | 'auth-error'

export type PendingReportRecord = {
  idempotencyKey: string
  orderId: string
  technicianId: string
  photoIds: string[]
  payload: TechnicianReportPayload
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  status: PendingReportStatus
  createdAt: number
}

export type PendingTransitionRecord = {
  idempotencyKey: string
  orderId: string
  payload: TechnicianTransitionPayload
  attempts: number
  lastAttemptAt: number | null
  lastError: string | null
  createdAt: number
}

export type ConflictKind = 'CANCELLED' | 'REASSIGNED' | 'AUTH' | 'OTHER'

export type ConflictRecord = {
  id: string
  orderId: string
  kind: ConflictKind
  reportSnapshot: PendingReportRecord | null
  transitionSnapshot: PendingTransitionRecord | null
  serverMessage: string | null
  createdAt: number
}

export type LocalJobSnapshot = {
  orderId: string
  status: string
  customer: { name: string | null; address: string | null }
  scheduledDate: string | null
  orderItems: Array<{
    id: string
    serviceType: string | null
    acUnitId: string | null
    acUnit: {
      id: string | null; brand: string | null; brandId: string | null
      modelNumber: string | null; serialNumber: string | null
      installationDate: string | null; acType: string | null
      unitTypeId: string | null; capacityId: string | null
      capacityLabel: string | null; roomLocation: string | null
      floorLevel: string | null; positionDetail: string | null
    } | null
  }>
  technicianId: string | null
  syncedAt: number
  locked: boolean
}

// =============================================================================
// Schema typing for idb
// =============================================================================

export interface TechnicianDB extends DBSchema {
  drafts: { key: string; value: DraftRecord }
  pendingPhotos: {
    key: string; value: PendingPhotoRecord
    indexes: { 'by-order': string }
  }
  pendingReports: {
    key: string; value: PendingReportRecord
    indexes: { 'by-order': string }
  }
  pendingTransitions: {
    key: string; value: PendingTransitionRecord
    indexes: { 'by-order': string }
  }
  conflicts: {
    key: string; value: ConflictRecord
    indexes: { 'by-order': string }
  }
  jobSnapshots: { key: string; value: LocalJobSnapshot }
}
