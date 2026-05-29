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

qaTest('R-10 new AC on-site — no auto-create, payload preserved', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r10', { acUnits: 2, label: 'NewACOnsite' })
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

    const newSerial = `NEW-SN-${scenario.prefix.slice(-6)}`
    const acUnitsPayload = [
      {
        ac_unit_id: scenario.acUnitIds[0],
        photos_before: ['https://example.com/ac0-before.jpg'],
        photos_after: ['https://example.com/ac0-after.jpg'],
        materials_used: [],
      },
      {
        ac_unit_id: scenario.acUnitIds[1],
        photos_before: ['https://example.com/ac1-before.jpg'],
        photos_after: ['https://example.com/ac1-after.jpg'],
        materials_used: [],
      },
      {
        ac_unit_id: null,
        brand: 'Sharp',
        model_number: 'NEW-MODEL',
        serial_number: newSerial,
        ac_type: 'Split',
        photos_before: ['https://example.com/new-before.jpg'],
        photos_after: ['https://example.com/new-after.jpg'],
        materials_used: [],
      },
    ]

    const { status, body } = await technicianSubmitReport(page.request, orderId, {
      idempotencyKey: crypto.randomUUID(),
      photosBefore: ['https://example.com/before.jpg'],
      photosAfter: ['https://example.com/after.jpg'],
      customerSignatureUrl: 'https://example.com/sig.png',
      customerNameSigned: 'QA Customer R10',
      actualTotalPrice: 450_000,
      acUnits: acUnitsPayload,
      nextServiceRecommendationDate: null,
    })
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(300)

    const supabase = getSupabaseAdmin()

    // No auto-create of ac_units row for the on-site discovery.
    const { data: newRows } = await supabase
      .from('ac_units')
      .select('ac_unit_id, brand, serial_number')
      .eq('serial_number', newSerial)
    expect(newRows ?? []).toHaveLength(0)

    // Payload preserved on service_reports.ac_units.
    const { data: report } = await supabase
      .from('service_reports')
      .select('ac_units')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle()
    expect(report).not.toBeNull()
    const stored = report!.ac_units as Array<Record<string, unknown>>
    expect(stored).toHaveLength(3)
    expect(stored[2].ac_unit_id).toBeNull()
    expect(stored[2].brand).toBe('Sharp')
    expect(stored[2].serial_number).toBe(newSerial)

    const dir = evidenceDir('r10')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'payload.json'), JSON.stringify(acUnitsPayload, null, 2))
    writeFileSync(
      resolve(dir, 'db-snapshot.json'),
      JSON.stringify(
        {
          orderId,
          status,
          body,
          stored,
          autoCreatedAcUnits: newRows ?? [],
          finding:
            'Server intentionally does not auto-create ac_units rows for on-site discoveries. Admin must confirm via dashboard before AC enters inventory.',
        },
        null,
        2
      )
    )
  } finally {
    await ctx.close()
  }
})
