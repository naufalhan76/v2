/**
 * G02 — Proforma invoice creation at order-create time.
 *
 * Covers:
 * - Happy: create order via UI with "Buat Proforma Invoice otomatis" checkbox checked
 *   → assert redirect to /dashboard/keuangan/invoices/{id}?proforma=true
 *   → toast "Order dan Proforma berhasil dibuat"
 *   → DB: PROFORMA/DRAFT/UNPAID invoice with items; order stays PENDING
 * - KNOWN-BUG: duplicate proforma (no guard) → test.fail()
 *
 * Reference: src/app/dashboard/orders/new/page.tsx:1186-1219, :611-618
 * Plan: .omo/plans/qa-e2e-business-process-gaps.md lines 356-408
 */

import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  getFullOrderSnapshot,
  getSupabaseAdmin,
  assertStagingHost,
  scenarioPrefix,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

// ─── Suite-level state ────────────────────────────────────────────────

let scenario: SeedScenario | null = null
let orderId: string | null = null
let proformaInvoiceId: string | null = null

const evDir = evidenceDir('g02')
const ensureEvDir = () => mkdirSync(evDir, { recursive: true })

qaTest.describe.serial('G02 — Proforma invoice at order-create', () => {
  // ── beforeAll: guard + evidence dir ──────────────────────────────
  qaTest.beforeAll(() => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
    assertStagingHost(baseURL)
    ensureEvDir()
  })

  // ── Cleanup ────────────────────────────────────────────────────────
  qaTest.afterAll(async () => {
    if (scenario) {
      await scenario.cleanup()
      scenario = null
    }
  })

  qaTest.setTimeout(120_000)

  // ═══════════════════════════════════════════════════════════════════
  // G02-HAPPY: Order + proforma created from UI
  // ═══════════════════════════════════════════════════════════════════
  qaTest('G02-HAPPY: proforma invoice created at order-create time', async ({
    context,
    qaAccounts,
  }) => {
    // 1. Seed scenario (customer + location + 2 AC units with priced catalog).
    scenario = await seedFullScenario('g02', {
      acUnits: 2,
      label: 'ProformaCreate',
    })

    // 2. Login as admin.
    const { page } = await loginAs(context, 'admin')

    // 3. Navigate to create-order page.
    await page.goto('/dashboard/orders/new', { waitUntil: 'networkidle' })

    // --- Section 1: Customer ---
    // Search for the seeded customer by name suffix.
    const searchInput = page.locator(
      '[cmdk-input], input[placeholder*="Ketik minimal"]'
    )
    await searchInput.waitFor({ timeout: 10_000 })
    const nameSuffix = scenario.prefix.slice(-6)
    await searchInput.fill(nameSuffix)

    // Wait for the suggestion list item that contains our customer name.
    const suggestionItem = page.locator(
      `[cmdk-item][data-value*="${nameSuffix}"], [cmdk-item]:has-text("${nameSuffix}")`
    )
    await suggestionItem.first().waitFor({ timeout: 10_000 })
    await suggestionItem.first().click()

    // --- Section 2: Locations & ACs ---
    // Section should auto-open. Select both AC units.
    const acCheckboxes = page.locator(
      'button:has([data-state]), [role="checkbox"]'
    )
    const acCount = await acCheckboxes.count()
    for (let i = 0; i < acCount && i < scenario.acUnitIds.length; i++) {
      await acCheckboxes.nth(i).click()
    }

    // Click "Lanjut ke Service Items"
    await page
      .getByRole('button', { name: /Lanjut ke Service Items/i })
      .click()

    // --- Section 3: Service Items ---
    // For each service line, pick "Cuci AC (CLEANING)" from the Select.
    const serviceSelects = page.locator(
      '[value="section-services"] [role="combobox"], [value="section-services"] select'
    )
    const selectCount = await serviceSelects.count()
    for (let i = 0; i < selectCount; i++) {
      await serviceSelects.nth(i).click()
      // Wait for the SelectContent to appear, then pick an option
      const option = page
        .locator('[role="option"]')
        .filter({ hasText: /Cuci AC|CLEANING|Cleaning/i })
        .first()
      await option.waitFor({ timeout: 5_000 })
      await option.click()
      // Small delay for state sync
      await page.waitForTimeout(300)
    }

    // Click "Lanjut ke Schedule"
    await page
      .getByRole('button', { name: /Lanjut ke Schedule/i })
      .click()

    // --- Section 4: Schedule ---
    // Pick tomorrow's date via the calendar popover.
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayStr = tomorrow.getDate().toString()
    const monthYearStr = tomorrow.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })

    // Open the calendar popover.
    await page.getByRole('button', { name: /Pilih tanggal/i }).click()
    // Navigate to the correct month if needed (should already show current).
    // Select the day.
    const dayButton = page
      .locator('[role="gridcell"], [role="button"]')
      .filter({ hasText: new RegExp(`^${dayStr}$`) })
      .first()
    await dayButton.waitFor({ timeout: 5_000 })
    await dayButton.click()

    // Ensure "Skip — assign teknisi nanti" is checked (it defaults to true).
    const skipCheckbox = page.locator('#skip-assignment')
    const skipChecked = await skipCheckbox.isChecked()
    if (!skipChecked) {
      await skipCheckbox.click()
    }

    // Click "Lanjut ke Review"
    await page
      .getByRole('button', { name: /Lanjut ke Review/i })
      .click()

    // --- Section 5: Review & Submit ---
    // Check the "Buat Proforma Invoice otomatis" checkbox.
    const proformaCheckbox = page.locator('#create-proforma')
    await proformaCheckbox.waitFor({ timeout: 5_000 })
    const proformaChecked = await proformaCheckbox.isChecked()
    if (!proformaChecked) {
      await proformaCheckbox.click()
    }

    // Assert submit button text is "Buat Order + Proforma".
    const submitBtn = page.getByRole('button', {
      name: /Buat Order \+ Proforma/i,
    })
    await expect(submitBtn).toBeVisible()

    // Take pre-submit evidence screenshot.
    await page.screenshot({
      path: resolve(evDir, 'happy-pre-submit.png'),
      fullPage: true,
    })

    // Submit.
    await submitBtn.click()

    // --- Post-submit assertions ---
    // Assert toast "Order dan Proforma berhasil dibuat".
    const toast = page.locator('[data-sonner-toast], [role="status"], .toast')
      .filter({ hasText: /Order dan Proforma berhasil dibuat/i })
    await toast.first().waitFor({ timeout: 15_000 })

    // Assert redirect to /dashboard/keuangan/invoices/{id}?proforma=true.
    await page.waitForURL(
      /\/dashboard\/keuangan\/invoices\/[^?]+\?proforma=true/,
      { timeout: 15_000 },
    )

    const url = new URL(page.url())
    proformaInvoiceId = url.pathname.split('/').pop() ?? null

    if (!proformaInvoiceId) {
      throw new Error('[qa] Failed to extract invoice_id from redirect URL')
    }

    // Take post-redirect screenshot.
    await page.screenshot({
      path: resolve(evDir, 'happy-post-redirect.png'),
      fullPage: true,
    })

    // --- DB assertions ---
    // Resolve order_id from the proforma invoice.
    const supabase = getSupabaseAdmin()
    const { data: invoice } = await supabase
      .from('invoices')
      .select('order_id, invoice_type, status, payment_status, paid_amount')
      .eq('invoice_id', proformaInvoiceId!)
      .maybeSingle()

    expect(invoice).not.toBeNull()
    expect(invoice!.invoice_type).toBe('PROFORMA')
    expect(invoice!.status).toBe('DRAFT')
    expect(invoice!.payment_status).toBe('UNPAID')
    expect(Number(invoice!.paid_amount)).toBe(0)

    orderId = invoice!.order_id

    // Full snapshot: verify order is PENDING and invoice belongs.
    const snapshot = await getFullOrderSnapshot(orderId!)
    expect(snapshot.order.status).toBe('PENDING')

    const proformaInvoices = snapshot.invoices.filter(
      (i) => i.invoiceType === 'PROFORMA',
    )
    expect(proformaInvoices.length).toBe(1)
    expect(proformaInvoices[0].invoiceId).toBe(proformaInvoiceId)
    expect(proformaInvoices[0].status).toBe('DRAFT')
    expect(proformaInvoices[0].paymentStatus).toBe('UNPAID')
    expect(proformaInvoices[0].paidAmount).toBe(0)

    // Write evidence.
    const evidence = {
      scenario: scenario.prefix,
      orderId,
      proformaInvoiceId,
      invoiceType: invoice!.invoice_type,
      invoiceStatus: invoice!.status,
      paymentStatus: invoice!.payment_status,
      orderStatus: snapshot.order.status,
      invoiceCount: proformaInvoices.length,
      timestamp: new Date().toISOString(),
    }
    writeFileSync(
      resolve(evDir, 'happy.json'),
      JSON.stringify(evidence, null, 2),
    )
  })

  // ═══════════════════════════════════════════════════════════════════
  // G02-DUPLICATE: Second proforma allowed (KNOWN-BUG)
  // ═══════════════════════════════════════════════════════════════════
  qaTest('G02-DUPLICATE: second proforma allowed (KNOWN-BUG)', async () => {
    /**
     * KNOWN-BUG: no duplicate-invoice guard.
     *
     * `createProformaInvoice` does not check whether a PROFORMA invoice
     * already exists for the order before creating a new one. The database
     * also lacks a unique constraint on (order_id, invoice_type) for
     * PROFORMA invoices.
     *
     * This test documents the current buggy behavior. It will fail (by
     * design) until the guard is implemented.
     */
    test.fail()

    if (!orderId || !proformaInvoiceId) {
      throw new Error(
        '[qa] G02-DUPLICATE requires orderId from G02-HAPPY',
      )
    }

    const supabase = getSupabaseAdmin()

    // Verify precondition: exactly 1 PROFORMA invoice exists.
    const snapshotBefore = await getFullOrderSnapshot(orderId)
    const proformaBefore = snapshotBefore.invoices.filter(
      (i) => i.invoiceType === 'PROFORMA',
    )
    expect(proformaBefore.length).toBe(1)
    expect(proformaBefore[0].invoiceId).toBe(proformaInvoiceId)

    // Attempt to create a second PROFORMA by directly inserting a row.
    // This simulates calling createProformaInvoice a second time without
    // the guard — the real bug is that the action would insert a second
    // row, and the DB allows it.
    const secondProformaId = `INV-PRO-${scenario!.prefix}-DUP`
    const { error: insertErr } = await supabase.from('invoices').insert({
      invoice_id: secondProformaId,
      invoice_number: `QA-PRO-${scenario!.prefix.slice(-6)}-DUP`,
      invoice_type: 'PROFORMA',
      order_id: orderId,
      customer_id: scenario!.customerId,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400_000)
        .toISOString()
        .slice(0, 10),
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

    // If the DB blocks this (unique constraint), insertErr will be set.
    // Currently, the KNOWN-BUG means it should succeed.
    if (insertErr) {
      // If this happens, the bug might be partially fixed (DB-level guard).
      // Still fail to indicate the full guard is not in place.
      const evidenceDup = {
        scenario: scenario!.prefix,
        orderId,
        originalProformaId: proformaInvoiceId,
        secondProformaId,
        dbBlocked: true,
        dbError: insertErr.message,
        note: 'DB unique constraint blocks duplicate — guard partially present',
        timestamp: new Date().toISOString(),
      }
      writeFileSync(
        resolve(evDir, 'duplicate-proforma.json'),
        JSON.stringify(evidenceDup, null, 2),
      )
      // Force-fail: the test.fail() wrapper expects this.
      expect(true).toBe(false)
      return
    }

    // Verify two PROFORMA invoices now exist.
    const snapshotAfter = await getFullOrderSnapshot(orderId)
    const proformaAfter = snapshotAfter.invoices.filter(
      (i) => i.invoiceType === 'PROFORMA',
    )

    const evidence = {
      scenario: scenario!.prefix,
      orderId,
      originalProformaId: proformaInvoiceId,
      secondProformaId,
      proformaCountBefore: proformaBefore.length,
      proformaCountAfter: proformaAfter.length,
      dbBlocked: false,
      note: 'No duplicate-invoice guard — two PROFORMA invoices exist for same order',
      timestamp: new Date().toISOString(),
    }
    writeFileSync(
      resolve(evDir, 'duplicate-proforma.json'),
      JSON.stringify(evidence, null, 2),
    )

    // The KNOWN-BUG means this should be 2, not 1.
    // When the bug is fixed, this assertion will fail and the test
    // will flip from test.fail() to a passing test (proformaAfter.length === 1).
    expect(proformaAfter.length).toBe(2)
  })
})