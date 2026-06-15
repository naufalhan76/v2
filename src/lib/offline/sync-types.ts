/**
 * Shared sync types — extracted to break circular dependencies between:
 * sync-manager.ts ↔ sync-photos.ts
 * sync-manager.ts ↔ sync-reports.ts
 * sync-manager.ts ↔ sync-transitions.ts
 */

export type DrainQueueOptions = {
  bypassBackoff?: boolean
}

export type DrainResult = {
  reportsAttempted: number
  transitionsAttempted: number
  reportsSynced: number
  transitionsSynced: number
  errors: Array<{
    kind: 'report' | 'transition'
    key: string
    message: string
    status?: import('./db').PendingReportStatus
  }>
}
