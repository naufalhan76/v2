export {
  qaTest,
  expect,
  loginAs,
  type QaRole,
} from './roles'
export { seedFullScenario, seedOrder, assignLeadTechnician, getTechnicianIdByEmail } from './seeders'
export { purgeByPrefix, purgeAllQaData } from './cleanup'
export {
  getFullOrderSnapshot,
  getOrderStatus,
  getReminderCount,
} from './db-asserts'
export {
  adminAssignOrder,
  adminCancelOrder,
  technicianTransition,
  technicianSubmitReport,
  getJobsToday,
} from './api-helpers'
export { openDualContexts, waitForRealtimeUpdate } from './realtime'
export { synthJpegBlob, synthSignaturePng } from './synth'
export { getSupabaseAdmin, makePrefix, evidenceDir, loadQaAccounts } from './env'
export type {
  QaPrefix,
  SeedScenario,
  SeedScenarioOpts,
  CreatedOrder,
  AssignmentResult,
  ServiceReportSnapshot,
  InvoiceSnapshot,
  StatusTransitionSnapshot,
  FullOrderSnapshot,
  QaRoleAccount,
  QaAccounts,
} from './types'
