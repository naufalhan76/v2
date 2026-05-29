import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  assignLeadTechnician,
  getTechnicianIdByEmail,
  technicianTransition,
  technicianSubmitReport,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-13 API contract — invalid multi-AC payload rejected, valid idempotency replays', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r13', { acUnits: 1, label: 'ApiContract' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  if (!techId) {
    testInfo.skip(true, 'technicianLead missing')
    return
  }
  await assignLeadTechnician(orderId, techId)

  const ctx = await browser.newContext()
  try {
    const { page } = await loginAs(ctx, 'technicianLead')

    // 1. Invalid GPS payload (lat out of range)
    const badGps = await technicianTransition(page.request, orderId, 'EN_ROUTE', {
      gps: { lat: 999, lng: 0, accuracy_m: 1, captured_at: new Date().toISOString(), gps_error: null },
    })
    expect(badGps.status).toBe(400)

    // 2. Valid EN_ROUTE/IN_PROGRESS so we can submit a report.
    expect((await technicianTransition(page.request, orderId, 'EN_ROUTE')).status).toBe(200)
    expect((await technicianTransition(page.request, orderId, 'IN_PROGRESS')).status).toBe(200)

    // 3. Invalid multi-AC payload — ac_units[0] missing both ac_unit_id AND
    //    brand AND not skipped.
    const invalidReport = await page.request.post(`/api/technician/jobs/${orderId}/report`, {
      data: {
        idempotency_key: crypto.randomUUID(),
        photos_before: ['https://example.com/b.jpg'],
        photos_after: ['https://example.com/a.jpg'],
        customer_signature_url: 'https://example.com/s.png',
        customer_name_signed: 'QA',
        actual_total_price: 100_000,
        materials: [],
        ac_units: [{ photos_before: [], photos_after: [], materials_used: [] }],
      },
    })
    expect(invalidReport.status()).toBe(400)
    const errorBody = await invalidReport.json().catch(() => ({}))
    const errorMsg = (
      (errorBody as { error?: string; message?: string }).error ??
      (errorBody as { error?: string; message?: string }).message ??
      ''
    ).toLowerCase()
    expect(errorMsg).toMatch(/ac_units|skip|brand|identifier/)

    // 4. Valid report with idempotency_key — submit twice, expect dedupe.
    const idempotencyKey = crypto.randomUUID()
    const validPayload = {
      idempotencyKey,
      photosBefore: ['https://example.com/b.jpg'],
      photosAfter: ['https://example.com/a.jpg'],
      customerSignatureUrl: 'https://example.com/s.png',
      customerNameSigned: 'QA R-13',
      actualTotalPrice: 150_000,
      acUnits: [
        {
          ac_unit_id: scenario.acUnitIds[0],
          photos_before: ['https://example.com/b.jpg'],
          photos_after: ['https://example.com/a.jpg'],
          materials_used: [],
        },
      ],
      nextServiceRecommendationDate: null,
    }
    const first = await technicianSubmitReport(page.request, orderId, validPayload)
    const second = await technicianSubmitReport(page.request, orderId, validPayload)
    expect(first.status).toBeGreaterThanOrEqual(200)
    expect(first.status).toBeLessThan(300)
    expect(second.status).toBeGreaterThanOrEqual(200)
    expect(second.status).toBeLessThan(300)

    const dir = evidenceDir('r13')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'api-contract.json'),
      JSON.stringify(
        {
          orderId,
          badGpsStatus: badGps.status,
          invalidReportStatus: invalidReport.status(),
          invalidReportBody: errorBody,
          firstSubmit: first,
          secondSubmit: second,
        },
        null,
        2
      )
    )
  } finally {
    await ctx.close()
  }
})
