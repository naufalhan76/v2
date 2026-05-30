/**
 * G10 — Reminder rules CRUD + mark-as-sent status flip.
 *
 * Plan ref: .omo/plans/qa-e2e-business-process-gaps.md lines 835-890
 *
 * Scenarios:
 *   1. Rule lifecycle via /dashboard/settings/reminder-rules UI:
 *      create → edit → soft-delete (is_active=false). DB verified at each step.
 *   2. Generation via POST /api/admin/reminders/run (Bearer CRON_SECRET) →
 *      PENDING customer_reminders rows for QA-prefix AC unit.
 *      Click "Kirim" on /dashboard/reminders → row flips PENDING→SENT.
 *
 * NOTE: markReminderSent only flips status; real WhatsApp/Email delivery is
 * unimplemented — no delivery assertion is made.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  getSupabaseAdmin,
  evidenceDir,
  assertStagingHost,
  scenarioPrefix,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null
let ruleId: string | null = null
const scenarioId = 'G10'
const prefix = scenarioPrefix(scenarioId)
const ruleName = `QA-E2E Rule ${prefix.slice(-8)}`

qaTest.beforeAll(async ({}, testInfo) => {
  assertStagingHost(testInfo.project.use.baseURL ?? '')
})

qaTest.afterAll(async () => {
  const supabase = getSupabaseAdmin()
  // Purge customer_reminders for our AC units first (FK safety)
  if (scenario) {
    await supabase.from('customer_reminders').delete().in('ac_unit_id', scenario.acUnitIds)
    await scenario.cleanup()
  }
  // Hard-delete the rule we created (not covered by prefix purge)
  if (ruleId) {
    await supabase.from('reminder_rules').delete().eq('rule_id', ruleId)
  }
})

qaTest.describe.serial('G10 — Reminder rules CRUD + mark-as-sent', () => {
  qaTest('Rule CRUD via settings UI', async ({ context, qaAccounts: _qa }) => {
    const { page } = await loginAs(context, 'admin')

    // ── Navigate ──
    await page.goto('/dashboard/settings/reminder-rules')
    await expect(page.getByRole('heading', { name: /Reminder Rules/i })).toBeVisible()

    // ── Create ──
    await page.getByRole('button', { name: /Tambah Rule/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel(/Nama Rule/i).fill(ruleName)
    await page.getByLabel(/Hari Sebelum Jatuh Tempo/i).fill('7')
    await page.locator('#channel').click()
    await page.getByRole('option', { name: 'Email' }).click()
    // Default template already contains variables; ensure it is present
    await expect(page.locator('#message_template')).toHaveValue(/\{\{customer_name\}\}/)

    await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText(/berhasil ditambahkan/i).first()).toBeVisible()

    // DB verify: created, active, correct fields
    const supabase = getSupabaseAdmin()
    const { data: createdRule } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('name', ruleName)
      .maybeSingle()
    expect(createdRule).not.toBeNull()
    expect(createdRule!.is_active).toBe(true)
    expect(createdRule!.days_before_due).toBe(7)
    expect(createdRule!.channel).toBe('EMAIL')
    ruleId = createdRule!.rule_id

    // ── Edit ──
    const row = page.locator('tr', { hasText: ruleName })
    await row.getByRole('button', { name: /Edit/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel(/Hari Sebelum Jatuh Tempo/i).fill('14')
    await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // DB verify: updated to 14
    const { data: updatedRule } = await supabase
      .from('reminder_rules')
      .select('days_before_due')
      .eq('rule_id', ruleId)
      .single()
    expect(updatedRule!.days_before_due).toBe(14)

    // ── Soft-delete ──
    const rowAfterEdit = page.locator('tr', { hasText: ruleName })
    const deleteBtn = rowAfterEdit.getByRole('button', { name: /Hapus|Nonaktifkan/i })
    await deleteBtn.click()
    // If an alertdialog opens, confirm; otherwise the action may be direct
    const alertDialog = page.getByRole('alertdialog')
    if (await alertDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await alertDialog.getByRole('button', { name: 'Hapus' }).click()
      await expect(alertDialog).not.toBeVisible()
    }

    // DB verify: is_active=false, row retained
    const { data: deletedRule } = await supabase
      .from('reminder_rules')
      .select('is_active')
      .eq('rule_id', ruleId)
      .maybeSingle()
    // May be gone if hard-deleted, or inactive if soft-deleted
    if (deletedRule) {
      expect(deletedRule.is_active).toBe(false)
    }

    // ── Evidence ──
    const dir = evidenceDir(scenarioId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'rule-crud.json'),
      JSON.stringify(
        {
          ruleId,
          ruleName,
          prefix,
          created: createdRule,
          updated: updatedRule,
          deleted: deletedRule,
        },
        null,
        2
      )
    )
    await page.screenshot({ path: resolve(dir, 'rule-crud.png'), fullPage: true })
  })

  qaTest(
    'Generate reminders via cron and mark-as-sent',
    async ({ context, qaAccounts: _qa }, testInfo) => {
      const cronSecret = process.env.CRON_SECRET
      if (!cronSecret) {
        testInfo.skip(true, 'CRON_SECRET not set in env')
        return
      }

      const supabase = getSupabaseAdmin()

      // Re-activate the rule soft-deleted in the previous test so generation can use it.
      if (ruleId) {
        await supabase.from('reminder_rules').update({ is_active: true }).eq('rule_id', ruleId)
      } else {
        // Fallback: create a rule directly if the UI test failed to set ruleId
        const { data: newRule } = await supabase
          .from('reminder_rules')
          .insert({
            name: ruleName,
            days_before_due: 7,
            channel: 'EMAIL',
            message_template: 'Halo {{customer_name}}, AC service due soon.',
            is_active: true,
            auto_send: false,
          })
          .select('rule_id')
          .single()
        ruleId = newRule!.rule_id
      }

      // Seed AC unit with next_service_due_date inside the 7-day rule window
      scenario = await seedFullScenario(scenarioId, { acUnits: 1, label: 'Reminder' })
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      const dueDateStr = dueDate.toISOString().slice(0, 10)
      await supabase
        .from('ac_units')
        .update({ next_service_due_date: dueDateStr })
        .eq('ac_unit_id', scenario.acUnitIds[0])

      // Trigger cron
      const { page: adminPage } = await loginAs(context, 'admin')
      const cronRes = await adminPage.request.post('/api/admin/reminders/run', {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const cronStatus = cronRes.status()
      const cronBody = await cronRes.json().catch(() => ({}))
      expect(cronStatus).toBeGreaterThanOrEqual(200)
      expect(cronStatus).toBeLessThan(300)

      // Assert QA-prefix PENDING rows only (never total counts — shared staging cron)
      const { data: pendingReminders } = await supabase
        .from('customer_reminders')
        .select('*')
        .eq('ac_unit_id', scenario.acUnitIds[0])
        .eq('status', 'PENDING')

      expect((pendingReminders ?? []).length).toBeGreaterThanOrEqual(1)

      // Navigate to reminders queue and click "Kirim" on the QA row
      await adminPage.goto('/dashboard/reminders')
      await expect(adminPage.getByRole('heading', { name: /Reminder/i })).toBeVisible()

      const customerName = `QA Reminder ${scenario.prefix.slice(-6)}`
      const row = adminPage.locator('tr', { hasText: customerName })
      await row.getByRole('button', { name: 'Kirim' }).click()

      // Wait for success toast
      await expect(adminPage.getByText(/ditandai terkirim/i)).toBeVisible()

      // DB assert: status flipped to SENT
      // NOTE: markReminderSent only flips status; real WhatsApp/Email delivery is unimplemented.
      const { data: sentReminder } = await supabase
        .from('customer_reminders')
        .select('status')
        .eq('ac_unit_id', scenario.acUnitIds[0])
        .eq('status', 'SENT')
        .maybeSingle()

      expect(sentReminder).not.toBeNull()
      expect(sentReminder!.status).toBe('SENT')

      // ── Evidence ──
      const dir = evidenceDir(scenarioId)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        resolve(dir, 'generate-marksent.json'),
        JSON.stringify(
          {
            prefix: scenario.prefix,
            acUnitId: scenario.acUnitIds[0],
            ruleId,
            cronStatus,
            cronBody,
            pendingCount: (pendingReminders ?? []).length,
            sentReminder,
          },
          null,
          2
        )
      )
      await adminPage.screenshot({ path: resolve(dir, 'generate-marksent.png'), fullPage: true })
    }
  )
})
