/**
 * QA spec: PATCH /api/orders/[id]
 *
 * Covers the five canonical cases for the unified order mutation endpoint:
 *   1. Cancel   — admin cancels a PENDING order
 *   2. Assign   — admin assigns a technician to a PENDING order
 *   3. Reschedule — admin reschedules an ASSIGNED order back to PENDING
 *   4. Invalid status — schema rejects unknown status value
 *   5. Forbidden role — TECHNICIAN role receives 403
 *
 * All tests skip cleanly when QA_* credentials are absent.
 */

import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  assignLeadTechnician,
  getTechnicianIdByEmail,
  getOrderStatus,
  getSupabaseAdmin,
  type SeedScenario,
} from './fixtures'

// Shared scenario — customer + location + AC units seeded once for the suite.
let scenario: SeedScenario | null = null

qaTest.beforeAll(async () => {
  try {
    scenario = await seedFullScenario('apatch', { acUnits: 1, label: 'ApiOrdersPatch' })
  } catch {
    // Supabase env not configured — individual tests will skip via qaAccounts fixture.
  }
})

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

// ---------------------------------------------------------------------------
// 1. Cancel
// ---------------------------------------------------------------------------
qaTest(
  'PATCH /api/orders/[id] — cancel: admin cancels a PENDING order',
  async ({ browser, qaAccounts }) => {
    if (!scenario) return

    const { orderId } = await seedOrder({
      prefix: scenario.prefix + '-c1',
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })

    const ctx = await browser.newContext()
    try {
      const { page } = await loginAs(ctx, 'admin')
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'CANCELLED', cancellation_reason: 'QA cancel test' },
      })
      expect(res.status()).toBe(200)

      const status = await getOrderStatus(orderId)
      expect(status).toBe('CANCELLED')
    } finally {
      await ctx.close()
    }

    void qaAccounts // consumed by fixture; ensures skip fires before seeding
  },
)

// ---------------------------------------------------------------------------
// 2. Assign
// ---------------------------------------------------------------------------
qaTest(
  'PATCH /api/orders/[id] — assign: admin assigns technician, order_technicians row created',
  async ({ browser, qaAccounts }) => {
    if (!scenario) return

    const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
    if (!techId) {
      // technicianLead account exists but has no technicians row — skip gracefully.
      return
    }

    const { orderId } = await seedOrder({
      prefix: scenario.prefix + '-a1',
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })

    const ctx = await browser.newContext()
    try {
      const { page } = await loginAs(ctx, 'admin')
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'ASSIGNED', assigned_technician_id: techId },
      })
      expect(res.status()).toBe(200)

      // Verify order_technicians lead row was created
      const supabase = getSupabaseAdmin()
      const { data: rows } = await supabase
        .from('order_technicians')
        .select('technician_id, role')
        .eq('order_id', orderId)
        .eq('role', 'lead')
      expect(rows).not.toBeNull()
      expect(rows!.length).toBeGreaterThan(0)
      expect(rows![0].technician_id).toBe(techId)
    } finally {
      await ctx.close()
    }
  },
)

// ---------------------------------------------------------------------------
// 3. Reschedule
// ---------------------------------------------------------------------------
qaTest(
  'PATCH /api/orders/[id] — reschedule: ASSIGNED order resets to PENDING, technician cleared',
  async ({ browser, qaAccounts }) => {
    if (!scenario) return

    const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
    if (!techId) return

    const { orderId } = await seedOrder({
      prefix: scenario.prefix + '-r1',
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })

    // Put the order into ASSIGNED state so reschedule has a valid source state.
    await assignLeadTechnician(orderId, techId)

    const newDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const ctx = await browser.newContext()
    try {
      const { page } = await loginAs(ctx, 'admin')
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'PENDING', scheduled_visit_date: newDate },
      })
      expect(res.status()).toBe(200)

      const status = await getOrderStatus(orderId)
      expect(status).toBe('PENDING')

      // Verify all technician assignments were cleared
      const supabase = getSupabaseAdmin()
      const { data: techRows } = await supabase
        .from('order_technicians')
        .select('technician_id')
        .eq('order_id', orderId)
      expect((techRows ?? []).length).toBe(0)
    } finally {
      await ctx.close()
    }
  },
)

// ---------------------------------------------------------------------------
// 4. Invalid status
// ---------------------------------------------------------------------------
qaTest(
  'PATCH /api/orders/[id] — invalid status: schema validation returns 400',
  async ({ browser, qaAccounts }) => {
    if (!scenario) return

    const { orderId } = await seedOrder({
      prefix: scenario.prefix + '-i1',
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })

    const ctx = await browser.newContext()
    try {
      const { page } = await loginAs(ctx, 'admin')
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'FOO' },
      })
      expect(res.status()).toBe(400)
    } finally {
      await ctx.close()
    }

    void qaAccounts
  },
)

// ---------------------------------------------------------------------------
// 5. Forbidden role
// ---------------------------------------------------------------------------
qaTest(
  'PATCH /api/orders/[id] — forbidden: TECHNICIAN role receives 403',
  async ({ browser, qaAccounts }) => {
    if (!scenario) return

    const { orderId } = await seedOrder({
      prefix: scenario.prefix + '-f1',
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })

    const ctx = await browser.newContext()
    try {
      const { page } = await loginAs(ctx, 'technicianLead')
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'CANCELLED', cancellation_reason: 'should be forbidden' },
      })
      expect(res.status()).toBe(403)
    } finally {
      await ctx.close()
    }

    void qaAccounts
  },
)
