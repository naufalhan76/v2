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

qaTest('R-07 / R-13 — report POSTed 3x with same idempotency_key collapses to 1 row', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r07', { acUnits: 2, label: 'Idempotent' })
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
    const { page: techPage } = await loginAs(ctx, 'technicianLead')

    expect((await technicianTransition(techPage.request, orderId, 'EN_ROUTE')).status).toBe(200)
    expect((await technicianTransition(techPage.request, orderId, 'IN_PROGRESS')).status).toBe(200)

    const idempotencyKey = crypto.randomUUID()
    const payload = {
      idempotencyKey,
      photosBefore: ['https://example.com/before.jpg'],
      photosAfter: ['https://example.com/after.jpg'],
      customerSignatureUrl: 'https://example.com/sig.png',
      customerNameSigned: 'QA Customer R07',
      actualTotalPrice: 300_000,
      acUnits: scenario.acUnitIds.map((acId) => ({
        ac_unit_id: acId,
        photos_before: ['https://example.com/before.jpg'],
        photos_after: ['https://example.com/after.jpg'],
        materials_used: [],
      })),
      notes: 'QA R-07 idempotency test',
      nextServiceRecommendationDate: null,
    }

    const responses: Array<{ attempt: number; status: number; body: unknown }> = []
    for (let i = 1; i <= 3; i++) {
      const r = await technicianSubmitReport(techPage.request, orderId, payload)
      responses.push({ attempt: i, status: r.status, body: r.body })
    }

    // First call should succeed (200 or 201). Subsequent should return 200
    // with idempotent_replay flag (when server-side dedup is wired).
    expect(responses[0].status).toBeGreaterThanOrEqual(200)
    expect(responses[0].status).toBeLessThan(300)
    expect(responses[1].status).toBeGreaterThanOrEqual(200)
    expect(responses[1].status).toBeLessThan(300)
    expect(responses[2].status).toBeGreaterThanOrEqual(200)
    expect(responses[2].status).toBeLessThan(300)

    // Server-side: exactly one service_reports row.
    const supabase = getSupabaseAdmin()
    const { data: reports } = await supabase
      .from('service_reports')
      .select('report_id, idempotency_key')
      .eq('order_id', orderId)
      .is('deleted_at', null)
    expect(reports ?? []).toHaveLength(1)
    expect(reports![0].idempotency_key).toBe(idempotencyKey)

    // Document whether idempotent_replay flag is exposed on retries.
    const replayFlags = responses.slice(1).map((r) => {
      const b = r.body as { idempotent_replay?: boolean; data?: { idempotent_replay?: boolean } }
      return b.idempotent_replay ?? b.data?.idempotent_replay ?? null
    })
    if (replayFlags.some((f) => f !== true)) {
      testInfo.annotations.push({
        type: 'finding',
        description: `idempotent_replay flag not surfaced consistently. Replay flags: ${JSON.stringify(replayFlags)}. DB still has exactly 1 row, so dedup works server-side.`,
      })
    }

    const dir = evidenceDir('r07')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'idempotency.json'),
      JSON.stringify(
        {
          orderId,
          idempotencyKey,
          responses,
          dbReportCount: reports?.length ?? 0,
          replayFlags,
        },
        null,
        2
      )
    )
  } finally {
    await ctx.close()
  }
})
