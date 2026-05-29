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
  getJobsToday,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-05 add helper — helper sees order, only lead transitions', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r05', { acUnits: 1, label: 'AddHelper' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const tech1Id = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  const tech2Id = await getTechnicianIdByEmail(qaAccounts.technicianHelper.email)
  if (!tech1Id || !tech2Id) {
    testInfo.skip(true, 'technician accounts missing')
    return
  }

  await assignLeadTechnician(orderId, tech1Id)

  const tech1Ctx = await browser.newContext()
  const tech2Ctx = await browser.newContext()
  try {
    const { page: tech1Page } = await loginAs(tech1Ctx, 'technicianLead')
    const enRoute = await technicianTransition(tech1Page.request, orderId, 'EN_ROUTE')
    expect(enRoute.status).toBe(200)
    const inProgress = await technicianTransition(tech1Page.request, orderId, 'IN_PROGRESS')
    expect(inProgress.status).toBe(200)

    // Admin adds helper via admin client
    const supabase = getSupabaseAdmin()
    await supabase.from('order_technicians').insert({
      order_id: orderId,
      technician_id: tech2Id,
      role: 'helper',
    })

    const { page: tech2Page } = await loginAs(tech2Ctx, 'technicianHelper')
    const tech2Jobs = await getJobsToday(tech2Page)
    const tech2Sees = tech2Jobs.some((j) => j.order_id === orderId)
    expect(tech2Sees).toBe(true)

    // Helper attempts COMPLETED transition — must be blocked.
    const helperAttempt = await technicianTransition(
      tech2Page.request,
      orderId,
      'COMPLETED'
    )
    expect([400, 403, 422]).toContain(helperAttempt.status)

    const dir = evidenceDir('r05')
    mkdirSync(dir, { recursive: true })
    await tech2Page.screenshot({ path: resolve(dir, 'helper-jobs.png') }).catch(() => {})
    await tech1Page.screenshot({ path: resolve(dir, 'lead-in-progress.png') }).catch(() => {})
    writeFileSync(
      resolve(dir, 'result.json'),
      JSON.stringify(
        {
          orderId,
          tech1Id,
          tech2Id,
          tech2Sees,
          helperTransitionStatus: helperAttempt.status,
          helperTransitionBody: helperAttempt.body,
        },
        null,
        2
      )
    )
  } finally {
    await tech1Ctx.close()
    await tech2Ctx.close()
  }
})
