// G07 — Email-send graceful fail + disabled state.
// Plan: .omo/plans/qa-e2e-business-process-gaps.md:654-707
//
// Guards:    assertStagingHost; skip if RESEND_API_KEY IS present
//            (we test failure path — cannot run when real emails would fire).
// Happy:     customer HAS email → button enabled → click → API 500
//            "Email service is not configured" + toast "Gagal Kirim Email"
//            → invoice stays DRAFT.
// Negative:  customer NO email → button disabled.

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrderToState,
  getSupabaseAdmin,
  evidenceDir,
  assertStagingHost,
  scenarioPrefix,
  purgeByPrefix,
  type SeedScenario,
} from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// ── module-level state (serial) ──────────────────────────────────────

let scenario: SeedScenario | null = null
let invoiceWithEmail: string
let invoiceNoEmail: string
let financePage: Page
let financeCtx: BrowserContext

const EVIDENCE = evidenceDir('G07')

// ── describe ─────────────────────────────────────────────────────────

qaTest.describe.serial('G07 — Email-send graceful fail + disabled state', () => {
  qaTest.setTimeout(180_000)

  // ── beforeAll ──────────────────────────────────────────────────────

  qaTest.beforeAll(async ({ browser, qaAccounts }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? ''
    assertStagingHost(baseURL)

    // Guard: skip if RESEND_API_KEY IS set (can't test failure path when
    // real emails would be sent). The helper resendKeyAbsentOrSkip does the
    // opposite (skip when key absent for success-path tests), so we guard
    // inline here.
    if (process.env.RESEND_API_KEY) {
      testInfo.skip(
        true,
        '[qa] RESEND_API_KEY is set — cannot test graceful failure; skipping',
      )
    }

    mkdirSync(EVIDENCE, { recursive: true })

    scenario = await seedFullScenario(scenarioPrefix('G07'), {
      acUnits: 2,
      label: 'EmailSend',
    })
    const supabase = getSupabaseAdmin()

    // ── 1. Invoice WITH email customer ──

    const adminCtx = await browser.newContext()
    const techCtx = await browser.newContext()
    const { page: adminPage } = await loginAs(adminCtx, 'admin')
    const { page: techPage } = await loginAs(techCtx, 'technicianLead')

    const { snapshot } = await seedOrderToState(scenario, 'INVOICED', {
      techRequest: techPage.request,
      adminRequest: adminPage.request,
      technicianEmail: qaAccounts.technicianLead.email,
    })

    let finalInv = snapshot.invoices.find((i) => i.invoiceType === 'FINAL')
    if (!finalInv) {
      const invId = crypto.randomUUID()
      const today = new Date().toISOString().slice(0, 10)
      const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
      const invNumber = `QA-G07-${Date.now()}`
      await supabase.from('invoices').insert({
        invoice_id: invId,
        invoice_number: invNumber,
        invoice_type: 'FINAL',
        order_id: snapshot.order.orderId,
        customer_id: scenario.customerId,
        invoice_date: today,
        due_date: due,
        service_type: 'CLEANING',
        service_name: 'AC Cleaning',
        base_service_quantity: 2,
        base_service_price: 300_000,
        base_service_total: 300_000,
        addons_subtotal: 0,
        subtotal: 300_000,
        discount_amount: 0,
        discount_percentage: 0,
        tax_percentage: 0,
        tax_amount: 0,
        total_amount: 300_000,
        status: 'DRAFT',
        payment_status: 'UNPAID',
        paid_amount: 0,
      })
      finalInv = { invoiceId: invId, invoiceType: 'FINAL', status: 'DRAFT', paymentStatus: 'UNPAID', totalAmount: 300_000, paidAmount: 0 }
    }
    invoiceWithEmail = finalInv.invoiceId

    // Verify customer has email from seed
    const { data: custWithEmail } = await supabase
      .from('customers')
      .select('email')
      .eq('customer_id', scenario.customerId)
      .single()
    if (!custWithEmail?.email) {
      throw new Error('[qa] Seeded customer has no email — test precond violated')
    }

    await adminPage.close()
    await techPage.close()
    await adminCtx.close()
    await techCtx.close()

    // ── 2. Invoice WITHOUT email customer ──

    const noEmailCustId = `CUST-${scenario.prefix}-noemail`
    await supabase.from('customers').insert({
      customer_id: noEmailCustId,
      customer_name: `QA NoEmail ${scenario.prefix.slice(-6)}`,
      primary_contact_person: 'QA Tester',
      phone_number: '+62811000001',
      email: null,
      billing_address: 'Jl. QA No. 2',
      notes: `[seed:${scenario.prefix}]`,
    })

    const noEmailOrderId = `ORD-${scenario.prefix}-noemail`
    await supabase.from('orders').insert({
      order_id: noEmailOrderId,
      customer_id: noEmailCustId,
      location_id: scenario.locationId,
      order_type: 'CLEANING',
      description: `[seed:${scenario.prefix}-noemail]`,
      status: 'COMPLETED',
      req_visit_date: new Date().toISOString().slice(0, 10),
      scheduled_visit_date: new Date().toISOString().slice(0, 10),
    })

    const noEmailInvNumber = `QA-NE-${scenario.prefix.slice(-6)}`
    const { data: insertedInv } = await supabase
      .from('invoices')
      .insert({
        invoice_number: noEmailInvNumber,
        invoice_type: 'FINAL',
        order_id: noEmailOrderId,
        customer_id: noEmailCustId,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        service_type: 'CLEANING',
        service_name: 'AC Cleaning',
        base_service_quantity: 1,
        base_service_price: 150_000,
        base_service_total: 150_000,
        subtotal: 150_000,
        total_amount: 150_000,
        status: 'DRAFT',
        payment_status: 'UNPAID',
        paid_amount: 0,
      })
      .select('invoice_id')
      .single()

    if (!insertedInv) throw new Error('[qa] Failed to create no-email invoice')
    invoiceNoEmail = insertedInv.invoice_id

    // ── 3. Login finance for tests ──

    financeCtx = await browser.newContext()
    const { page } = await loginAs(financeCtx, 'finance')
    financePage = page
  })

  // ── afterAll ───────────────────────────────────────────────────────

  qaTest.afterAll(async () => {
    if (scenario) await purgeByPrefix(scenario.prefix)
    await financeCtx?.close().catch(() => {})
  })

  // ── Test 1: Send fails gracefully when key absent ──────────────────

  qaTest('email send fails gracefully when key absent', async () => {
    await financePage.goto(`/dashboard/keuangan/invoices/${invoiceWithEmail}`, {
      waitUntil: 'networkidle',
    })
    await financePage
      .locator('[data-testid="dashboard-shell"]')
      .first()
      .waitFor({ timeout: 15_000 })

    // Assert "Send to Email" button is ENABLED (customer has email)
    const sendBtn = financePage.getByRole('button', { name: /send to.*email/i })
    await expect(sendBtn).toBeVisible({ timeout: 10_000 })
    await expect(sendBtn).toBeEnabled()

    // Wait for React state to settle before clicking
    await financePage.waitForTimeout(2000)

    // Click the button — page.route interception unreliable on staging build
    await sendBtn.click()

    // Assert toast "Gagal Kirim Email" appears (API fails when RESEND_KEY absent)
    await expect(
      financePage.getByText(/Gagal Kirim Email/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    // DB: invoice status must still be DRAFT (no promotion to SENT)
    const supabase = getSupabaseAdmin()
    const { data: invRow } = await supabase
      .from('invoices')
      .select('status')
      .eq('invoice_id', invoiceWithEmail)
      .single()
    expect(invRow?.status).toBe('DRAFT')

    // Evidence
    writeFileSync(
      resolve(EVIDENCE, 'send-fail.json'),
      JSON.stringify(
        {
          invoiceId: invoiceWithEmail,
          statusAfterSend: invRow?.status,
          note: 'API route interception unreliable on staging build; verified via toast + DB',
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
    await financePage
      .screenshot({ path: resolve(EVIDENCE, 'send-fail.png') })
      .catch(() => {})
  })

  // ── Test 2: Button disabled when customer has no email ─────────────

  qaTest('send button disabled without customer email', async () => {
    await financePage.goto(`/dashboard/keuangan/invoices/${invoiceNoEmail}`, {
      waitUntil: 'networkidle',
    })
    await financePage
      .locator('[data-testid="dashboard-shell"]')
      .first()
      .waitFor({ timeout: 15_000 })

    // Assert "Send to Email" button is DISABLED
    const sendBtn = financePage.getByRole('button', { name: /send to.*email/i })
    await expect(sendBtn).toBeVisible({ timeout: 10_000 })
    await expect(sendBtn).toBeDisabled()

    // Evidence
    writeFileSync(
      resolve(EVIDENCE, 'no-email-disabled.json'),
      JSON.stringify(
        {
          invoiceId: invoiceNoEmail,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
    await financePage
      .screenshot({ path: resolve(EVIDENCE, 'no-email-disabled.png') })
      .catch(() => {})
  })
})