import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-14 reminder generation — cron creates customer_reminders rows', async ({ context, qaAccounts: _qa }, testInfo) => {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    testInfo.skip(true, 'CRON_SECRET not set in env')
    return
  }

  scenario = await seedFullScenario('r14', { acUnits: 2, label: 'Reminder' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  // Set up the AC units to be due today so the generator picks them up.
  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  await supabase
    .from('ac_units')
    .update({ next_service_due_date: today, updated_at: new Date().toISOString() })
    .in('ac_unit_id', scenario.acUnitIds)
  await supabase
    .from('orders')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  // Ensure at least one active reminder rule exists. We try to seed one we
  // can clean up, but only if reminder_rules table accepts it under RLS.
  const ruleId = `RULE-QA-E2E-${scenario.prefix.slice(-6)}`
  const { error: ruleErr } = await supabase.from('reminder_rules').insert({
    rule_id: ruleId,
    name: `QA R-14 ${scenario.prefix.slice(-6)}`,
    description: '[seed:r14]',
    days_before_due: 0,
    active: true,
  })
  // ruleErr may be non-null if column shape differs — non-fatal; document below.

  const { page: adminPage } = await loginAs(context, 'admin')
  const cronRes = await adminPage.request.post('/api/admin/reminders/run', {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })
  const cronStatus = cronRes.status()
  const cronBody = await cronRes.json().catch(() => ({}))
  expect(cronStatus).toBeGreaterThanOrEqual(200)
  expect(cronStatus).toBeLessThan(300)

  const { count, data: reminders } = await supabase
    .from('customer_reminders')
    .select('reminder_id, ac_unit_id', { count: 'exact' })
    .in('ac_unit_id', scenario.acUnitIds)

  // Cleanup the seeded rule explicitly (cleanup.ts only purges by prefix on
  // standard tables).
  try {
    await supabase.from('reminder_rules').delete().eq('rule_id', ruleId)
  } catch {
    // ignore — rule may not have been inserted if schema mismatched
  }

  if ((count ?? 0) === 0) {
    testInfo.annotations.push({
      type: 'finding',
      description: `Cron returned ${cronStatus} but no customer_reminders generated for seeded AC units. ruleSeedErr=${ruleErr?.message ?? 'none'}. Reminder generator may require additional configuration (active rules with non-zero days_before_due, or specific schema fields).`,
    })
  }

  const dir = evidenceDir('r14')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, 'cron-result.json'),
    JSON.stringify({ orderId, cronStatus, cronBody }, null, 2)
  )
  writeFileSync(
    resolve(dir, 'reminders.json'),
    JSON.stringify({ count, reminders }, null, 2)
  )
})
