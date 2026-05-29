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
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-03 reschedule from EN_ROUTE — resets to PENDING', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r03', { acUnits: 1, label: 'Reschedule' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
  })

  const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  if (!techId) {
    testInfo.skip(true, 'technicianLead not found in technicians table')
    return
  }
  await assignLeadTechnician(orderId, techId)

  const techCtx = await browser.newContext()
  try {
    const { page: techPage } = await loginAs(techCtx, 'technicianLead')
    const enRoute = await technicianTransition(techPage.request, orderId, 'EN_ROUTE', {
      gps: { lat: -6.21, lng: 106.85, accuracy_m: 10, captured_at: new Date().toISOString(), gps_error: null },
    })
    expect(enRoute.status).toBe(200)

    const supabase = getSupabaseAdmin()
    const newDate = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)

    // Production reschedule path is rescheduleOrder server action — we simulate
    // its DB effect: status back to PENDING, scheduled_visit_date pushed,
    // technician assignments cleared, transition logged.
    await supabase
      .from('orders')
      .update({
        status: 'PENDING',
        assigned_technician_id: null,
        scheduled_visit_date: newDate,
        req_visit_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
    await supabase.from('order_technicians').delete().eq('order_id', orderId)
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: 'EN_ROUTE',
      to_status: 'PENDING',
      notes: `Reschedule to ${newDate}`,
    })

    const after = await getFullOrderSnapshot(orderId)
    expect(after.order.status).toBe('PENDING')
    const reschedule = after.transitions.find(
      (t) => t.fromStatus === 'EN_ROUTE' && t.toStatus === 'PENDING'
    )
    expect(reschedule).toBeDefined()
    expect(reschedule!.notes?.toLowerCase()).toContain('reschedule')

    const { data: techRows } = await supabase
      .from('order_technicians')
      .select('technician_id')
      .eq('order_id', orderId)
    expect(techRows ?? []).toHaveLength(0)

    const dir = evidenceDir('r03')
    mkdirSync(dir, { recursive: true })
    await techPage.screenshot({ path: resolve(dir, 'tech-after-reschedule.png') }).catch(() => {})
    writeFileSync(
      resolve(dir, 'result.json'),
      JSON.stringify({ orderId, newDate, after, reschedule }, null, 2)
    )
  } finally {
    await techCtx.close()
  }
})
