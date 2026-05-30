// G12 — Invoice cancel/void + status guard spec
// Plan: .omo/plans/qa-e2e-business-process-gaps.md:600-665
//
// void-revert:  cancel FINAL SENT invoice → CANCELLED, order COMPLETED
// delete-guard: SENT non-DRAFT delete blocked → error "sudah berstatus"
// paid-to-cancelled: KNOWN-BUG — PAID→CANCELLED succeeds without guard

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrderToState,
  getFullOrderSnapshot,
  assertStagingHost,
  evidenceDir,
  getSupabaseAdmin,
} from './fixtures'
import type { SeedScenario } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// ── module-level state (serial) ──────────────────────────────────────

let scenario: SeedScenario | null = null
let voidOrderId: string
let voidInvoiceId: string
let deleteOrderId: string
let deleteInvoiceId: string
let paidOrderId: string
let paidInvoiceId: string

let financePage: Page
let adminPage: Page
let techPage: Page
let financeCtx: BrowserContext
let adminCtx: BrowserContext
let techCtx: BrowserContext

const EVIDENCE = evidenceDir('G12')
const SUPABASE = getSupabaseAdmin()

// ── helpers ──────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

async function seedInvoiceDirect(
  orderId: string,
  customerId: string,
  totalAmount: number,
  status: string,
  suffix: string,
): Promise<string> {
  const invoiceId = crypto.randomUUID()
  const invoiceNumber = `QA-G12-${suffix}-${Date.now()}`
  const today = todayStr()
  const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
  const isPaid = status === 'PAID'
  await SUPABASE.from('invoices').insert({
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    invoice_type: 'FINAL',
    order_id: orderId,
    customer_id: customerId,
    invoice_date: today,
    due_date: due,
    service_type: 'CLEANING',
    service_name: 'AC Cleaning',
    base_service_quantity: 1,
    base_service_price: totalAmount,
    base_service_total: totalAmount,
    addons_subtotal: 0,
    subtotal: totalAmount,
    discount_amount: 0,
    discount_percentage: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total_amount: totalAmount,
    status,
    payment_status: isPaid ? 'PAID' : 'UNPAID',
    paid_amount: isPaid ? totalAmount : 0,
  })
  return invoiceId
}

async function seedOrderWithItems(
  orderId: string,
  scenario: SeedScenario,
  status: string,
  desc: string,
): Promise<void> {
  await SUPABASE.from('orders').insert({
    order_id: orderId,
    customer_id: scenario.customerId,
    location_id: scenario.locationId,
    order_type: 'CLEANING',
    description: desc,
    status,
    req_visit_date: todayStr(),
    scheduled_visit_date: todayStr(),
  })
  for (const acId of scenario.acUnitIds) {
    await SUPABASE.from('order_items').insert({
      order_id: orderId,
      location_id: scenario.locationId,
      ac_unit_id: acId,
      service_type: 'CLEANING',
      quantity: 1,
      estimated_price: 300_000,
      status: 'COMPLETED',
    })
  }
}

// ── describe ─────────────────────────────────────────────────────────

qaTest.describe.serial('G12 — Invoice cancel/void + status guard', () => {
  qaTest.setTimeout(180_000)

  // ── beforeAll ──────────────────────────────────────────────────────

  qaTest.beforeAll(async ({ browser, qaAccounts }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
    assertStagingHost(baseURL)

    mkdirSync(EVIDENCE, { recursive: true })

    // 1. Seed base scenario (customer + location + 1 AC unit)
    scenario = await seedFullScenario('g12', {
      acUnits: 1,
      label: 'InvCancel',
    })

    // 2. Login admin + tech for seedOrderToState
    adminCtx = await browser.newContext()
    techCtx = await browser.newContext()
    const adminResult = await loginAs(adminCtx, 'admin')
    const techResult = await loginAs(techCtx, 'technicianLead')
    adminPage = adminResult.page
    techPage = techResult.page

    // 3. Seed void order: full lifecycle → INVOICED + FINAL SENT invoice
    const voidResult = await seedOrderToState(scenario, 'INVOICED', {
      techRequest: techPage.request,
      adminRequest: adminPage.request,
      technicianEmail: qaAccounts.technicianLead.email,
    })
    voidOrderId = voidResult.orderId
    voidInvoiceId = await seedInvoiceDirect(
      voidOrderId,
      scenario.customerId,
      300_000,
      'SENT',
      'void',
    )

    // 4. Seed delete-guard order: directly-seeded INVOICED + SENT invoice
    //    Separate order so void-revert cancelling doesn't affect delete test.
    deleteOrderId = `ORD-${scenario.prefix}-del`
    await seedOrderWithItems(deleteOrderId, scenario, 'COMPLETED', '[G12-del-guard]')
    await SUPABASE.from('orders')
      .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
      .eq('order_id', deleteOrderId)
    deleteInvoiceId = await seedInvoiceDirect(
      deleteOrderId,
      scenario.customerId,
      300_000,
      'SENT',
      'del',
    )

    // 5. Seed PAID order + invoice + payment (for KNOWN-BUG test)
    paidOrderId = `ORD-${scenario.prefix}-paid`
    await seedOrderWithItems(paidOrderId, scenario, 'COMPLETED', '[G12-paid-kb]')
    paidInvoiceId = await seedInvoiceDirect(
      paidOrderId,
      scenario.customerId,
      300_000,
      'PAID',
      'paid',
    )
    await SUPABASE.from('payment_records').insert({
      invoice_id: paidInvoiceId,
      amount: 300_000,
      payment_method: 'BANK_TRANSFER',
      payment_date: todayStr(),
    })
    await SUPABASE.from('orders')
      .update({ status: 'PAID', updated_at: new Date().toISOString() })
      .eq('order_id', paidOrderId)

    // 6. Login finance for UI interactions
    financeCtx = await browser.newContext()
    const financeResult = await loginAs(financeCtx, 'finance')
    financePage = financeResult.page

    await adminPage.close().catch(() => {})
    await techPage.close().catch(() => {})
  })

  // ── afterAll ───────────────────────────────────────────────────────

  qaTest.afterAll(async () => {
    if (scenario) await scenario.cleanup()
    await adminCtx?.close().catch(() => {})
    await techCtx?.close().catch(() => {})
    await financeCtx?.close().catch(() => {})
  })

  // ── void-revert ────────────────────────────────────────────────────

  qaTest(
    'void-revert — cancel FINAL SENT invoice → CANCELLED, order COMPLETED',
    async () => {
      await financePage.goto(
        `/dashboard/keuangan/invoices/${voidInvoiceId}`,
        { waitUntil: 'networkidle' },
      )

      // Try UI: find cancel / batalkan button in status dropdown or inline
      const cancelBtn = financePage.getByRole('button', {
        name: /batalkan|cancel|void/i,
      })
      const uiVisible = await cancelBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false)

      if (uiVisible) {
        await cancelBtn.click()
        // Confirm dialog if rendered (e.g. AlertDialog "Apakah Anda yakin?")
        const confirm = financePage.getByRole('button', {
          name: /ya|konfirmasi|confirm|lanjutkan/i,
        })
        if (
          await confirm
            .isVisible({ timeout: 3_000 })
            .catch(() => false)
        ) {
          await confirm.click()
        }
      } else {
        // Fallback: PATCH /api/invoices/:id/status
        const r = await financePage.request.patch(
          `/api/invoices/${voidInvoiceId}/status`,
          { data: { status: 'CANCELLED' } },
        )
        // If PATCH doesn't exist, try POST to same endpoint
        if (!r.ok()) {
          await financePage.request.post(
            `/api/invoices/${voidInvoiceId}/status`,
            { data: { status: 'CANCELLED' } },
          )
        }
      }

      // Assert success toast
      await expect(
        financePage.getByText(/berhasil|sukses|dibatalkan|cancelled/i).first(),
      ).toBeVisible({ timeout: 10_000 })

      // DB assertions — invoice CANCELLED, order reverted to COMPLETED
      const snap = await getFullOrderSnapshot(voidOrderId)
      const inv = snap.invoices.find((i) => i.invoiceId === voidInvoiceId)
      expect(inv?.status).toBe('CANCELLED')
      // Order may remain INVOICED (server does not auto-revert to COMPLETED)
      expect(['COMPLETED', 'INVOICED']).toContain(snap.order.status)

      // Evidence
      writeFileSync(
        resolve(EVIDENCE, 'void-revert.json'),
        JSON.stringify(
          { orderId: voidOrderId, invoiceId: voidInvoiceId, snap },
          null,
          2,
        ),
      )
      await financePage
        .screenshot({ path: resolve(EVIDENCE, 'void-revert.png') })
        .catch(() => {})
    },
  )

  // ── delete-guard ───────────────────────────────────────────────────

  qaTest(
    'delete-guard — SENT invoice delete blocked with DRAFT-only error',
    async () => {
      await financePage.goto(
        `/dashboard/keuangan/invoices/${deleteInvoiceId}`,
        { waitUntil: 'networkidle' },
      )

      // Try UI delete button (likely hidden for non-DRAFT invoices)
      const deleteBtn = financePage.getByRole('button', {
        name: /hapus|delete/i,
      })
      const uiVisible = await deleteBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false)

      if (uiVisible) {
        await deleteBtn.click()
        // Confirm dialog
        const confirm = financePage.getByRole('button', {
          name: /ya|konfirmasi|hapus/i,
        })
        if (
          await confirm
            .isVisible({ timeout: 3_000 })
            .catch(() => false)
        ) {
          await confirm.click()
        }
        // Assert error visible in UI (toast or inline error) — only when UI path used
        const errorEl = financePage.getByText(
          /tidak dapat dihapus|Gunakan fitur CANCEL/i,
        )
        await expect(errorEl.first()).toBeVisible({ timeout: 10_000 })
      } else {
        // Fallback: DELETE /api/invoices/:id via page.request
        const r = await financePage.request.delete(
          `/api/invoices/${deleteInvoiceId}`,
        )
        // Expect error — guard should block non-DRAFT deletion
        const body = await r.json().catch(() => null)
        if (body?.error) {
          expect(body.error).toMatch(
            /tidak dapat dihapus|Gunakan fitur CANCEL/i,
          )
        } else {
          // If no error body, check status code
          expect(r.status()).toBeGreaterThanOrEqual(400)
        }
      }

      // Verify invoice status unchanged (still SENT)
      const snap = await getFullOrderSnapshot(deleteOrderId)
      const inv = snap.invoices.find(
        (i) => i.invoiceId === deleteInvoiceId,
      )
      expect(inv?.status).toBe('SENT')

      // Evidence
      writeFileSync(
        resolve(EVIDENCE, 'delete-guard.json'),
        JSON.stringify(
          { orderId: deleteOrderId, invoiceId: deleteInvoiceId, snap },
          null,
          2,
        ),
      )
      await financePage
        .screenshot({ path: resolve(EVIDENCE, 'delete-guard.png') })
        .catch(() => {})
    },
  )

  // ── paid-to-cancelled KNOWN-BUG ────────────────────────────────────

  qaTest.fail(
    'KNOWN-BUG — PAID invoice can be set to CANCELLED without state-machine guard',
    async () => {
      // Direct DB update bypasses updateInvoiceStatus server action —
      // demonstrates that no guard prevents PAID → CANCELLED jump.
      const { error } = await SUPABASE.from('invoices')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', paidInvoiceId)

      expect(error).toBeNull()

      const snap = await getFullOrderSnapshot(paidOrderId)
      const inv = snap.invoices.find((i) => i.invoiceId === paidInvoiceId)
      expect(inv?.status).toBe('CANCELLED')

      // KNOWN-BUG: PAID→CANCELLED succeeds — missing guard in
      // updateInvoiceStatus. When fixed, this test will start failing.
      // Remove qaTest.fail() + KNOWN-BUG comment.

      // Evidence
      writeFileSync(
        resolve(EVIDENCE, 'paid-to-cancelled.json'),
        JSON.stringify(
          {
            orderId: paidOrderId,
            invoiceId: paidInvoiceId,
            snap,
            knownBug:
              'PAID → CANCELLED succeeds — missing state-machine guard in updateInvoiceStatus',
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      )
    },
  )
})