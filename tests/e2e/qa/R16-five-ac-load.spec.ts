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
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-16 5-AC load — submit time < 5s, all stored', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r16', { acUnits: 5, label: 'FiveAC' })
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
    expect((await technicianTransition(page.request, orderId, 'EN_ROUTE')).status).toBe(200)
    expect((await technicianTransition(page.request, orderId, 'IN_PROGRESS')).status).toBe(200)

    const acUnits = scenario.acUnitIds.map((acId, idx) => ({
      ac_unit_id: acId,
      photos_before: [
        `https://example.com/ac${idx}-b1.jpg`,
        `https://example.com/ac${idx}-b2.jpg`,
      ],
      photos_after: [
        `https://example.com/ac${idx}-a1.jpg`,
        `https://example.com/ac${idx}-a2.jpg`,
      ],
      materials_used: [],
    }))

    const t0 = Date.now()
    const { status, body } = await technicianSubmitReport(page.request, orderId, {
      idempotencyKey: crypto.randomUUID(),
      photosBefore: ['https://example.com/before.jpg'],
      photosAfter: ['https://example.com/after.jpg'],
      customerSignatureUrl: 'https://example.com/sig.png',
      customerNameSigned: 'QA Customer R16',
      actualTotalPrice: 750_000,
      acUnits,
      nextServiceRecommendationDate: null,
    })
    const submitMs = Date.now() - t0
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(300)
    expect(submitMs).toBeLessThan(5000)

    const supabase = getSupabaseAdmin()
    const { data: report } = await supabase
      .from('service_reports')
      .select('ac_units')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle()
    expect((report!.ac_units as unknown[])).toHaveLength(5)

    const dir = evidenceDir('r16')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'timing.json'),
      JSON.stringify({ orderId, submitMs, status, body }, null, 2)
    )
  } finally {
    await ctx.close()
  }
})
