/**
 * G06 — PDF export download verification.
 *
 * See .omo/plans/qa-e2e-business-process-gaps.md:599-650.
 *
 * Verifies that the client-side jsPDF export produces a browser download with
 * the correct filename and non-zero size for both FINAL and PROFORMA invoices.
 * No PDF content/text/layout parsing — download-only verification.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { statSync } from 'node:fs'
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

let scenario: SeedScenario | null = null
let finalInvoiceId = ''
let finalInvoiceNumber = ''
let proformaInvoiceId = ''
let proformaInvoiceNumber = ''

qaTest.beforeAll(async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? ''
  assertStagingHost(baseURL)
  scenario = await seedFullScenario(scenarioPrefix('G06'), { acUnits: 2, label: 'PdfExport' })
})

qaTest.afterAll(async () => {
  if (scenario) await purgeByPrefix(scenario.prefix)
})

qaTest.setTimeout(180_000)

qaTest.describe.serial('G06 — PDF export download verification', () => {
  qaTest('export FINAL invoice PDF — download fires, correct filename, size > 0', async ({ browser, qaAccounts }) => {
    if (!scenario) throw new Error('Scenario not seeded')

    const evDir = evidenceDir('G06')
    mkdirSync(evDir, { recursive: true })
    const supabase = getSupabaseAdmin()

    // Create browser contexts for admin + tech seeding paths
    const adminCtx = await browser.newContext()
    const techCtx = await browser.newContext()
    const financeCtx = await browser.newContext()

    const { page: adminPage } = await loginAs(adminCtx, 'admin')
    const { page: techPage } = await loginAs(techCtx, 'technicianLead')

    // 1. Seed order → INVOICED (creates FINAL invoice via server-side transition)
    const { orderId, snapshot } = await seedOrderToState(scenario, 'INVOICED', {
      techRequest: techPage.request,
      adminRequest: adminPage.request,
      technicianEmail: qaAccounts.technicianLead.email,
    })

    // If seedOrderToState didn't create a FINAL invoice (staging gap), create one manually
    let finalInv = snapshot.invoices.find((i) => i.invoiceType === 'FINAL')
    if (!finalInv) {
      const invId = crypto.randomUUID()
      const today = new Date().toISOString().slice(0, 10)
      const due = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
      const invNumber = `QA-G06-${Date.now()}`
      await supabase.from('invoices').insert({
        invoice_id: invId,
        invoice_number: invNumber,
        invoice_type: 'FINAL',
        order_id: orderId,
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
        status: 'SENT',
        payment_status: 'UNPAID',
        paid_amount: 0,
      })
      finalInv = { invoiceId: invId, invoiceType: 'FINAL', status: 'SENT', paymentStatus: 'UNPAID', totalAmount: 300_000, paidAmount: 0 }
    }
    finalInvoiceId = finalInv.invoiceId

    // Retrieve actual invoice_number from DB (snapshot type only exposes invoiceId)
    const { data: invRow } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('invoice_id', finalInvoiceId)
      .single()
    if (!invRow) throw new Error(`FINAL invoice ${finalInvoiceId} not found in DB`)
    finalInvoiceNumber = invRow.invoice_number

    // 2. Create a PROFORMA invoice on the same order
    proformaInvoiceNumber = `QA-PRO-${scenario.prefix.slice(-6)}`
    proformaInvoiceId = crypto.randomUUID()
    await supabase.from('invoices').insert({
      invoice_id: proformaInvoiceId,
      invoice_number: proformaInvoiceNumber,
      invoice_type: 'PROFORMA',
      order_id: orderId,
      customer_id: scenario.customerId,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
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

    // Release seeding browser resources
    await adminPage.close()
    await techPage.close()
    await adminCtx.close()
    await techCtx.close()

    // ── Export FINAL PDF ──
    const { page: financePage } = await loginAs(financeCtx, 'finance')

    await financePage.goto(`/dashboard/keuangan/invoices/${finalInvoiceId}`)
    await financePage.locator('[data-testid="dashboard-shell"]').first().waitFor({ timeout: 15_000 })

    const [download] = await Promise.all([
      financePage.waitForEvent('download', { timeout: 30_000 }),
      financePage.getByRole('button', { name: /export.*pdf|pdf/i }).click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toBe(`Invoice_${finalInvoiceNumber}.pdf`)

    const filePath = resolve(evDir, 'final-pdf-file')
    await download.saveAs(filePath)
    const fileSize = statSync(filePath).size
    expect(fileSize).toBeGreaterThan(0)

    writeFileSync(resolve(evDir, 'final-pdf.json'), JSON.stringify({
      invoiceId: finalInvoiceId,
      invoiceNumber: finalInvoiceNumber,
      invoiceType: 'FINAL',
      filename,
      fileSize,
      exportedAt: new Date().toISOString(),
    }, null, 2))

    await financePage.close()
    await financeCtx.close()
  })

  qaTest('export PROFORMA invoice PDF — download fires, filename contains proforma number, size > 0', async ({ browser }) => {
    if (!scenario) throw new Error('Scenario not seeded')
    if (!proformaInvoiceId) throw new Error('PROFORMA invoice not seeded — ensure FINAL test ran first')

    const evDir = evidenceDir('G06')

    const ctx = await browser.newContext()
    const { page } = await loginAs(ctx, 'finance')

    await page.goto(`/dashboard/keuangan/invoices/${proformaInvoiceId}`)
    await page.locator('[data-testid="dashboard-shell"]').first().waitFor({ timeout: 15_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /export.*pdf|pdf/i }).click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toBe(`Invoice_${proformaInvoiceNumber}.pdf`)

    const filePath = resolve(evDir, 'proforma-pdf-file')
    await download.saveAs(filePath)
    const fileSize = statSync(filePath).size
    expect(fileSize).toBeGreaterThan(0)

    writeFileSync(resolve(evDir, 'proforma-pdf.json'), JSON.stringify({
      invoiceId: proformaInvoiceId,
      invoiceNumber: proformaInvoiceNumber,
      invoiceType: 'PROFORMA',
      filename,
      fileSize,
      exportedAt: new Date().toISOString(),
    }, null, 2))

    await page.close()
    await ctx.close()
  })
})