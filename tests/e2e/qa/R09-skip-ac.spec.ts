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

qaTest('R-09 skip AC — third unit marked not-serviced', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r09', { acUnits: 3, label: 'SkipAC' })
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

    const acUnitsPayload = [
      {
        ac_unit_id: scenario.acUnitIds[0],
        photos_before: ['https://example.com/ac0-before.jpg'],
        photos_after: ['https://example.com/ac0-after.jpg'],
        materials_used: [{ name: 'Freon', qty: 1, unit_price: 100_000, total: 100_000 }],
      },
      {
        ac_unit_id: scenario.acUnitIds[1],
        photos_before: ['https://example.com/ac1-before.jpg'],
        photos_after: ['https://example.com/ac1-after.jpg'],
        materials_used: [],
      },
      {
        ac_unit_id: scenario.acUnitIds[2],
        skipped: true,
        skip_reason: 'AC rusak parah, perlu workshop',
        photos_before: [],
        photos_after: [],
        materials_used: [],
      },
    ]

    const { status, body } = await technicianSubmitReport(page.request, orderId, {
      idempotencyKey: crypto.randomUUID(),
      photosBefore: ['https://example.com/before.jpg'],
      photosAfter: ['https://example.com/after.jpg'],
      customerSignatureUrl: 'https://example.com/sig.png',
      customerNameSigned: 'QA Customer R09',
      actualTotalPrice: 300_000,
      acUnits: acUnitsPayload,
      nextServiceRecommendationDate: null,
    })
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(300)

    const supabase = getSupabaseAdmin()
    const { data: report } = await supabase
      .from('service_reports')
      .select('ac_units, actual_total_price')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle()
    expect(report).not.toBeNull()
    const stored = report!.ac_units as Array<Record<string, unknown>>
    expect(stored).toHaveLength(3)
    expect(stored[2].skipped).toBe(true)
    expect(stored[2].skip_reason).toBe('AC rusak parah, perlu workshop')
    expect(Number(report!.actual_total_price)).toBe(300_000)

    // F3-A2 guarantees skipped units are excluded from next_service_due_date
    // propagation. Assert directly so a regression surfaces as a hard failure.
    const { data: skippedAc } = await supabase
      .from('ac_units')
      .select('next_service_due_date')
      .eq('ac_unit_id', scenario.acUnitIds[2])
      .maybeSingle()
    expect(
      skippedAc?.next_service_due_date,
      'skipped AC must NOT receive next_service_due_date update (F3-A2)'
    ).toBeNull()

    const dir = evidenceDir('r09')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'skip-payload.json'), JSON.stringify(acUnitsPayload, null, 2))
    writeFileSync(
      resolve(dir, 'db-snapshot.json'),
      JSON.stringify(
        { orderId, status, body, stored, skipped_next_service: skippedAc },
        null,
        2
      )
    )
  } finally {
    await ctx.close()
  }
})
