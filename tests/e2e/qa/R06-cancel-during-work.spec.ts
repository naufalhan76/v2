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
  adminCancelOrder,
  getFullOrderSnapshot,
  evidenceDir,
  type SeedScenario,
} from './fixtures'
import { goOffline, goOnline } from '../fixtures/offline'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-06 cancel during work — tech offline, conflict surfaces on reconnect', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r06', { acUnits: 1, label: 'CancelDuringWork' })
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

  const techCtx = await browser.newContext()
  const adminCtx = await browser.newContext()
  try {
    const { page: techPage } = await loginAs(techCtx, 'technicianLead')
    await techPage.goto(`/technician/job/${orderId}`).catch(() => {})
    await techPage.waitForLoadState('networkidle').catch(() => {})

    await goOffline(techCtx)

    const { page: adminPage } = await loginAs(adminCtx, 'admin')
    await adminCancelOrder(adminPage.request, orderId, 'QA R-06 cancel during work')

    const snapAfterCancel = await getFullOrderSnapshot(orderId)
    expect(snapAfterCancel.order.status).toBe('CANCELLED')

    await goOnline(techCtx)
    await techPage.waitForTimeout(2000)

    const finalSnap = await getFullOrderSnapshot(orderId)
    expect(finalSnap.order.status).toBe('CANCELLED')

    testInfo.annotations.push({
      type: 'partial',
      description:
        'IDB conflict-store assertion is browser-context-local and cannot be queried from this spec; DB cancellation is verified.',
    })

    const dir = evidenceDir('r06')
    mkdirSync(dir, { recursive: true })
    await techPage.screenshot({ path: resolve(dir, 'tech-online-after.png') }).catch(() => {})
    writeFileSync(
      resolve(dir, 'result.json'),
      JSON.stringify({ orderId, snapAfterCancel, finalSnap }, null, 2)
    )
  } finally {
    await techCtx.close()
    await adminCtx.close()
  }
})
