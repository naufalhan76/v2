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
  getJobsToday,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-04 reassign lead — tech2 sees order, tech1 loses it', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r04', { acUnits: 1, label: 'Reassign' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const tech1Id = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  const tech2Id = await getTechnicianIdByEmail(qaAccounts.technicianHelper.email)
  if (!tech1Id || !tech2Id) {
    testInfo.skip(true, 'tech accounts not found')
    return
  }

  await assignLeadTechnician(orderId, tech1Id)

  // Reassign via PATCH /api/orders/[id] — assignOrdersToTechnician handles the lead swap
  const adminCtx = await browser.newContext()
  const { page: adminPage } = await loginAs(adminCtx, 'admin')
  const patchRes = await adminPage.request.patch(`/api/orders/${orderId}`, {
    data: { status: 'ASSIGNED', assigned_technician_id: tech2Id },
  })
  expect(patchRes.ok()).toBe(true)
  await adminCtx.close()

  const supabase = getSupabaseAdmin()

  const { data: leads } = await supabase
    .from('order_technicians')
    .select('technician_id, role')
    .eq('order_id', orderId)
    .eq('role', 'lead')
  expect(leads ?? []).toHaveLength(1)
  expect(leads![0].technician_id).toBe(tech2Id)

  const tech2Ctx = await browser.newContext()
  const tech1Ctx = await browser.newContext()
  try {
    const { page: tech2Page } = await loginAs(tech2Ctx, 'technicianHelper')
    const tech2Jobs = await getJobsToday(tech2Page)
    const tech2Sees = tech2Jobs.some((j) => j.order_id === orderId)
    expect(tech2Sees).toBe(true)

    const { page: tech1Page } = await loginAs(tech1Ctx, 'technicianLead')
    const tech1Jobs = await getJobsToday(tech1Page)
    const tech1Sees = tech1Jobs.some((j) => j.order_id === orderId)
    // tech1 should NOT see the order anymore
    expect(tech1Sees).toBe(false)

    const dir = evidenceDir('r04')
    mkdirSync(dir, { recursive: true })
    await tech2Page.screenshot({ path: resolve(dir, 'tech2-sees-order.png') }).catch(() => {})
    await tech1Page.screenshot({ path: resolve(dir, 'tech1-no-order.png') }).catch(() => {})
    writeFileSync(
      resolve(dir, 'result.json'),
      JSON.stringify({ orderId, tech1Id, tech2Id, tech2Sees, tech1Sees }, null, 2)
    )
  } finally {
    await tech2Ctx.close()
    await tech1Ctx.close()
  }
})
