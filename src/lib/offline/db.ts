/**
 * Barrel — re-exports everything from the split offline DB modules.
 */

// Core
export { getDb } from './db-core'

// Schema / types
export {
  DB_NAME,
  DB_VERSION,
  type TechnicianDB,
  type DraftRecord,
  type PhotoKind,
  type PendingPhotoRecord,
  type PendingReportStatus,
  type PendingReportRecord,
  type PendingTransitionRecord,
  type ConflictKind,
  type ConflictRecord,
  type LocalJobSnapshot,
} from './db-schema'

// Draft operations
export { putDraft, getDraft, deleteDraft } from './db-drafts'

// Photo operations
export {
  putPhoto,
  getPhoto,
  getPhotosForOrder,
  markPhotoUploaded,
  deletePhoto,
  deletePhotosForOrder,
} from './db-photos'

// Report operations
export { putReport, getReport, getAllReports, deleteReport } from './db-reports'

// Transition operations
export { putTransition, getAllTransitions, deleteTransition } from './db-transitions'

// Conflict operations
export { putConflict, getAllConflicts, deleteConflict } from './db-conflicts'

// Snapshot operations
export { putSnapshot, getSnapshot, getAllSnapshots, deleteSnapshot, lockSnapshot, unlockSnapshot } from './db-snapshots'

// Quota
export { getQuotaInfo, isQuotaCritical, type QuotaInfo } from './db-quota'
