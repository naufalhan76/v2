/**
 * Purge every QA-E2E-* row from staging. Run between full suite executions
 * to keep the DB tidy. Reuses the same prefix-based logic as the in-suite
 * cleanup helper.
 */

import { purgeAllQaData } from '../tests/e2e/qa/fixtures/cleanup'

async function main(): Promise<void> {
  console.log('[qa-cleanup] purging all QA-E2E-* rows…')
  await purgeAllQaData()
  console.log('[qa-cleanup] done')
}

main().catch((err) => {
  console.error('[qa-cleanup] failed:', err)
  process.exit(1)
})
