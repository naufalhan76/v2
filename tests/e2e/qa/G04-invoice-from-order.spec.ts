// G04 — Invoice creation from COMPLETED order.
// Plan: .omo/plans/qa-e2e-business-process-gaps.md:471-525
//
// Happy:   COMPLETED+report → "Buat Invoice" → FINAL/DRAFT → order INVOICED
// Fallback: COMPLETED w/o report → amber card → order stays COMPLETED

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrderToState,
  assignLeadTechnician,
  getTechnicianIdByEmail,
  getFullOrderSnapshot,
  technicianTransition,
  assertStagingHost,
  evidenceDir,
  getSupabaseAdmin,
} from './fixtures'
import type { SeedScenario } from './fixtures'
import type { OrderStatus } from '@/lib/order-status'
import type { Page, BrowserContext } from '@playwright/test'

// ── module-level state (serial) ──────────────────────────────────────

let scenario: SeedScenario | null = null
let happyOrderId: string
let noReportOrderId: string
let adminPage: Page
let techPage: Page
let adminCtx: BrowserContext
let techCtx: BrowserContext

const EVIDENCE = evidenceDir('G04')

// ── describe ─────────────────────────────────────────────────────────

qaTest.describe.serial('G04 — Invoice from completed order', () => {
  qaTest.setTimeout(180_000)

  // ── beforeAll ──────────────────────────────────────────────────────

  qaTest.beforeAll(async ({ browser, qaAccounts }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
    assertStagingHost(baseURL)

    mkdirSync(EVIDENCE, { recursive: true })

    // 1. Seed base scenario (customer + location + 2 AC units)
    scenario = await seedFullScenario('g04', {
      acUnits: 2,
      label: 'InvFromOrder',
    })

    // 2. Login admin + tech — keep pages alive for the tests
    adminCtx = await browser.newContext()
    techCtx = await browser.newContext()
    const adminResult = await loginAs(adminCtx, 'admin')
    const techResult = await loginAs(techCtx, 'technicianLead')
    adminPage = adminResult.page
    techPage = techResult.page

    const supabase = getSupabaseAdmin()

    // 3. Happy: seed order to COMPLETED WITH service report
    const happy = await seedOrderToState(scenario, 'COMPLETED', {
      techRequest: techPage.request,
      adminRequest: adminPage.request,
      technicianEmail: qaAccounts.technicianLead.email,
    })
    happyOrderId = happy.orderId

    // Verify preconditions
    const happySnap = await getFullOrderSnapshot(happyOrderId)
    if (happySnap.order.status !== 'COMPLETED') {
      throw new Error(
        `[qa] happy order not COMPLETED: ${happySnap.order.status}`,
      )
    }
    if (happySnap.reports.length === 0) {
      throw new Error('[qa] happy order has no service report')
    }

    // 4. No-report: create order, transition to COMPLETED without report
    const techId = await getTechnicianIdByEmail(
      qaAccounts.technicianLead.email,
    )
    if (!techId) throw new Error('[qa] technicianLead not found')

    // Embed within scenario prefix so scenario.cleanup() picks it up via ILIKE
    const nrOrderId = `ORD-${scenario.prefix}-norpt`
    await supabase.from('orders').insert({
      order_id: nrOrderId,
      customer_id: scenario.customerId,
      location_id: scenario.locationId,
      order_type: 'CLEANING',
      description: '[G04-no-report]',
      status: 'PENDING',
      req_visit_date: new Date().toISOString().slice(0, 10),
      scheduled_visit_date: new Date().toISOString().slice(0, 10),
    })
    for (const acId of scenario.acUnitIds) {
      await supabase.from('order_items').insert({
        order_id: nrOrderId,
        location_id: scenario.locationId,
        ac_unit_id: acId,
        service_type: 'CLEANING',
        quantity: 1,
        estimated_price: 150_000,
        status: 'PENDING',
      })
    }
    await assignLeadTechnician(nrOrderId, techId)

    // Transition through EN_ROUTE → IN_PROGRESS → COMPLETED
    for (const s of [
      'EN_ROUTE',
      'IN_PROGRESS',
      'COMPLETED',
    ] as OrderStatus[]) {
      const r = await technicianTransition(techPage.request, nrOrderId, s, {
        idempotencyKey: crypto.randomUUID(),
        gps: {
          lat: -6.2088,
          lng: 106.8456,
          accuracy_m: 5,
          captured_at: new Date().toISOString(),
        },
      })
      if (r.status < 200 || r.status > 299) {
        throw new Error(
          `[qa] no-report transition to ${s} failed: ${r.status} ${JSON.stringify(r.body)}`,
        )
      }
    }
    noReportOrderId = nrOrderId

    // Verify no-report preconditions
    const nrSnap = await getFullOrderSnapshot(noReportOrderId)
    if (nrSnap.order.status !== 'COMPLETED') {
      throw new Error(
        `[qa] no-report order not COMPLETED: ${nrSnap.order.status}`,
      )
    }
    if (nrSnap.reports.length > 0) {
      throw new Error('[qa] no-report order unexpectedly has a service report')
    }
  })

  // ── afterAll ───────────────────────────────────────────────────────

  qaTest.afterAll(async () => {
    if (scenario) await scenario.cleanup()
    await adminCtx?.close().catch(() => {})
    await techCtx?.close().catch(() => {})
  })

  // ── Happy path ─────────────────────────────────────────────────────

  qaTest(
    'happy — creates FINAL DRAFT invoice from COMPLETED order with report',
    async () => {
      // Navigate to the orders list filtered to our order
      await adminPage.goto(
        `/dashboard/orders?view=list&q=${encodeURIComponent(happyOrderId)}`,
        { waitUntil: 'networkidle' },
      )

      // Click the order row to open the detail panel
      const orderRow = adminPage.locator('tr', { hasText: happyOrderId }).first()
      await expect(orderRow).toBeVisible({ timeout: 15_000 })
      await orderRow.click()

      // Wait for the Sheet to open and "Buat Invoice" link to appear
      const buatInvoiceLink = adminPage.getByRole('link', {
        name: /buat invoice/i,
      })
      await expect(buatInvoiceLink).toBeVisible({ timeout: 10_000 })

      // Click the link — navigates to
      // /dashboard/keuangan/invoices/create/from-order/{orderId}
      // The server component calls createInvoiceFromOrder then redirects
      await buatInvoiceLink.click()

      // Assert redirect to invoice detail page with ?prefilled=service-report
      await adminPage.waitForURL(
        /\/dashboard\/keuangan\/invoices\/[^/]+\?prefilled=service-report/,
        { timeout: 30_000 },
      )

      // DB assertions
      const snap = await getFullOrderSnapshot(happyOrderId)
      expect(snap.order.status).toBe('INVOICED')

      const finalInvoice = snap.invoices.find(
        (i) => i.invoiceType === 'FINAL',
      )
      expect(finalInvoice).toBeDefined()
      expect(finalInvoice!.status).toBe('DRAFT')

      // Evidence
      writeFileSync(
        resolve(EVIDENCE, 'happy.json'),
        JSON.stringify(
          { orderId: happyOrderId, invoiceId: finalInvoice?.invoiceId, snap },
          null,
          2,
        ),
      )
      await adminPage
        .screenshot({ path: resolve(EVIDENCE, 'happy.png') })
        .catch(() => {})
    },
  )

  // ── Fallback: missing report ───────────────────────────────────────

  qaTest('fallback — missing report shows amber card', async () => {
    // Navigate directly to the create-from-order page
    await adminPage.goto(
      `/dashboard/keuangan/invoices/create/from-order/${noReportOrderId}`,
      { waitUntil: 'networkidle' },
    )

    // Assert amber card is visible
    const amberCard = adminPage.locator('.border-amber-200').first()
    await expect(amberCard).toBeVisible({ timeout: 15_000 })

    // Title
    await expect(
      amberCard.getByText('Tidak dapat auto-populate invoice'),
    ).toBeVisible()

    // Fallback description text
    await expect(
      amberCard.getByText(
        'Order ini belum memiliki service report dari teknisi. Anda bisa:',
      ),
    ).toBeVisible()

    // "Buat Invoice Manual" button linking to manual create with orderId
    const buatManual = amberCard.getByRole('link', {
      name: /buat invoice manual/i,
    })
    await expect(buatManual).toBeVisible()
    await expect(buatManual).toHaveAttribute(
      'href',
      `/dashboard/keuangan/invoices/create?orderId=${noReportOrderId}`,
    )

    // "Lihat Order" button linking back to the order
    const lihatOrder = amberCard.getByRole('link', { name: /lihat order/i })
    await expect(lihatOrder).toBeVisible()
    await expect(lihatOrder).toHaveAttribute(
      'href',
      `/dashboard/orders?orderId=${noReportOrderId}`,
    )

    // DB assertions: order still COMPLETED, no FINAL invoice
    const snap = await getFullOrderSnapshot(noReportOrderId)
    expect(snap.order.status).toBe('COMPLETED')

    const finalInvoice = snap.invoices.find(
      (i) => i.invoiceType === 'FINAL',
    )
    expect(finalInvoice).toBeUndefined()

    // Evidence
    writeFileSync(
      resolve(EVIDENCE, 'missing-report.json'),
      JSON.stringify({ orderId: noReportOrderId, snap }, null, 2),
    )
    await adminPage
      .screenshot({ path: resolve(EVIDENCE, 'missing-report.png') })
      .catch(() => {})
  })
})