/**
 * Q00 — fixture stack smoke test.
 *
 * Verifies the QA fixture infrastructure compiles and basic seeders/asserts
 * work before any of the heavier R-XX scenarios run.
 */

import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  loginAs,
  seedFullScenario,
  getFullOrderSnapshot,
  getSupabaseAdmin,
  type SeedScenario,
} from './fixtures'

const EVIDENCE_DIR = resolve(process.cwd(), '.omo/evidence/qa/q00-smoke')

function saveEvidence(testId: string, summary: string): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, `${testId}.txt`), summary + '\n', 'utf-8')
}

let smokeScenario: SeedScenario | null = null

qaTest('admin login works', async ({ context, qaAccounts: _qa }) => {
  const { page } = await loginAs(context, 'admin')
  await expect(page).toHaveURL(/\/dashboard/)
  saveEvidence('admin-login', `PASS url=${page.url()} ts=${new Date().toISOString()}`)
})

test('seedFullScenario creates customer + 2 AC units', async ({}, testInfo) => {
  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (err) {
    testInfo.skip(true, `Supabase env missing: ${(err as Error).message}`)
    return
  }
  smokeScenario = await seedFullScenario('q00-smoke')
  const { prefix } = smokeScenario

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .ilike('customer_id', `%${prefix}%`)
    .maybeSingle()
  expect(customer).not.toBeNull()
  expect(customer!.customer_id).toContain(prefix)

  const { data: acUnits } = await supabase
    .from('ac_units')
    .select('ac_unit_id')
    .ilike('ac_unit_id', `%${prefix}%`)
  expect(acUnits ?? []).toHaveLength(2)

  saveEvidence(
    'seed-scenario',
    `PASS prefix=${prefix} customer=${customer!.customer_id} ac=2 ts=${new Date().toISOString()}`
  )
})

test.afterAll(async () => {
  if (smokeScenario) {
    await smokeScenario.cleanup()
    smokeScenario = null
  }
})

test('getFullOrderSnapshot returns empty for nonexistent order', async ({}, testInfo) => {
  try {
    getSupabaseAdmin()
  } catch (err) {
    testInfo.skip(true, `Supabase env missing: ${(err as Error).message}`)
    return
  }
  const orderId = `nonexistent-${Date.now()}`
  const snapshot = await getFullOrderSnapshot(orderId)
  expect(snapshot.order.status).toBe('PENDING')
  expect(snapshot.reports).toHaveLength(0)
  expect(snapshot.invoices).toHaveLength(0)
  expect(snapshot.transitions).toHaveLength(0)
  expect(snapshot.payments).toHaveLength(0)
  saveEvidence('empty-snapshot', `PASS orderId=${orderId} all-empty ts=${new Date().toISOString()}`)
})
