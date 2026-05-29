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
  getFullOrderSnapshot,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-11 GPS denied / timeout — transition still succeeds', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r11', { acUnits: 1, label: 'GpsDenied' })
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
  await ctx.clearPermissions()
  try {
    const { page } = await loginAs(ctx, 'technicianLead')

    // EN_ROUTE with denied
    const enRoute = await technicianTransition(page.request, orderId, 'EN_ROUTE', {
      gps: {
        lat: null,
        lng: null,
        accuracy_m: null,
        captured_at: null,
        gps_error: 'denied',
      },
    })
    expect(enRoute.status).toBe(200)

    // IN_PROGRESS with timeout
    const inProgress = await technicianTransition(page.request, orderId, 'IN_PROGRESS', {
      gps: {
        lat: null,
        lng: null,
        accuracy_m: null,
        captured_at: null,
        gps_error: 'timeout',
      },
    })
    expect(inProgress.status).toBe(200)

    const snap = await getFullOrderSnapshot(orderId)
    const enRouteRow = snap.transitions.find((t) => t.toStatus === 'EN_ROUTE')
    const inProgressRow = snap.transitions.find((t) => t.toStatus === 'IN_PROGRESS')
    expect(enRouteRow?.gpsError).toBe('denied')
    expect(enRouteRow?.lat).toBeNull()
    expect(enRouteRow?.lng).toBeNull()
    expect(inProgressRow?.gpsError).toBe('timeout')

    const dir = evidenceDir('r11')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'transitions.json'),
      JSON.stringify({ orderId, transitions: snap.transitions }, null, 2)
    )
  } finally {
    await ctx.close()
  }
})
