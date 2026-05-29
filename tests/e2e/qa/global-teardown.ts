import { purgeAllQaData } from './fixtures/cleanup'

/**
 * Playwright globalTeardown — runs once after all workers finish.
 * Purges every QA-E2E-* row from staging as an orphan-safety net for
 * crashed workers whose afterAll hooks never ran.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    console.log('[qa-teardown] purging all QA-E2E-* rows...')
    await purgeAllQaData()
    console.log('[qa-teardown] done')
  } catch (err) {
    console.error('[qa-teardown] purge failed:', err)
    // Do not rethrow — teardown should never break the suite verdict.
  }
}
