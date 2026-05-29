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
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

type CaseResult = {
  case: number
  description: string
  requestBody: unknown
  responseStatus: number
  responseBody: unknown
  finalStatus: string | null
}

qaTest.describe('R-19 state machine negatives', () => {
  let scenario1: SeedScenario | null = null
  let scenario2: SeedScenario | null = null
  let scenario3: SeedScenario | null = null
  let scenario4: SeedScenario | null = null
  let scenario5: SeedScenario | null = null

  const caseResults: CaseResult[] = []

  qaTest.afterAll(async () => {
    const dir = evidenceDir('r19')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'transitions.json'),
      JSON.stringify(
        {
          suite: 'R-19 state machine negatives',
          generatedAt: new Date().toISOString(),
          cases: caseResults,
        },
        null,
        2
      )
    )
    await Promise.allSettled([
      scenario1?.cleanup(),
      scenario2?.cleanup(),
      scenario3?.cleanup(),
      scenario4?.cleanup(),
      scenario5?.cleanup(),
    ])
  })

  qaTest(
    'R-19 case 1 — PENDING to EN_ROUTE blocked (not assigned)',
    async ({ browser, qaAccounts }, testInfo) => {
      scenario1 = await seedFullScenario('r19-case1', { acUnits: 1, label: 'NegCase1' })
      const { orderId } = await seedOrder({
        prefix: scenario1.prefix,
        customerId: scenario1.customerId,
        locationId: scenario1.locationId,
        acUnitIds: scenario1.acUnitIds,
      })

      const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
      if (!techId) {
        testInfo.skip(true, 'technicianLead account missing')
        return
      }
      // Intentionally do NOT call assignLeadTechnician — order stays PENDING, tech not assigned

      const ctx = await browser.newContext()
      try {
        const { page } = await loginAs(ctx, 'technicianLead')
        const requestBody = { to_status: 'EN_ROUTE' }
        const { status: responseStatus, body: responseBody } = await technicianTransition(
          page.request,
          orderId,
          'EN_ROUTE'
        )

        expect([403, 422]).toContain(responseStatus)

        const supabase = getSupabaseAdmin()
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle()
        expect(order?.status).toBe('PENDING')

        const dir = evidenceDir('r19')
        mkdirSync(dir, { recursive: true })
        const evidence: CaseResult = {
          case: 1,
          description: 'PENDING to EN_ROUTE blocked (not assigned)',
          requestBody,
          responseStatus,
          responseBody,
          finalStatus: order?.status ?? null,
        }
        writeFileSync(resolve(dir, 'case1.json'), JSON.stringify(evidence, null, 2))
        caseResults.push(evidence)
      } finally {
        await ctx.close()
      }
    }
  )

  qaTest(
    'R-19 case 2 — IN_PROGRESS to CANCELLED blocked (technician cannot cancel)',
    async ({ browser, qaAccounts }, testInfo) => {
      scenario2 = await seedFullScenario('r19-case2', { acUnits: 1, label: 'NegCase2' })
      const { orderId } = await seedOrder({
        prefix: scenario2.prefix,
        customerId: scenario2.customerId,
        locationId: scenario2.locationId,
        acUnitIds: scenario2.acUnitIds,
      })

      const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
      if (!techId) {
        testInfo.skip(true, 'technicianLead account missing')
        return
      }
      await assignLeadTechnician(orderId, techId)

      const ctx = await browser.newContext()
      try {
        const { page } = await loginAs(ctx, 'technicianLead')

        // Advance to IN_PROGRESS via valid transitions
        expect((await technicianTransition(page.request, orderId, 'EN_ROUTE')).status).toBe(200)
        expect((await technicianTransition(page.request, orderId, 'IN_PROGRESS')).status).toBe(200)

        // Attempt invalid transition: IN_PROGRESS → CANCELLED (TECHNICIAN role cannot cancel)
        const requestBody = { to_status: 'CANCELLED' }
        const { status: responseStatus, body: responseBody } = await technicianTransition(
          page.request,
          orderId,
          'CANCELLED'
        )

        expect(responseStatus).toBe(422)

        const supabase = getSupabaseAdmin()
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle()
        expect(order?.status).toBe('IN_PROGRESS')

        const dir = evidenceDir('r19')
        mkdirSync(dir, { recursive: true })
        const evidence: CaseResult = {
          case: 2,
          description: 'IN_PROGRESS to CANCELLED blocked (technician cannot cancel)',
          requestBody,
          responseStatus,
          responseBody,
          finalStatus: order?.status ?? null,
        }
        writeFileSync(resolve(dir, 'case2.json'), JSON.stringify(evidence, null, 2))
        caseResults.push(evidence)
      } finally {
        await ctx.close()
      }
    }
  )

  qaTest(
    'R-19 case 3 — EN_ROUTE to COMPLETED blocked (skips IN_PROGRESS)',
    async ({ browser, qaAccounts }, testInfo) => {
      scenario3 = await seedFullScenario('r19-case3', { acUnits: 1, label: 'NegCase3' })
      const { orderId } = await seedOrder({
        prefix: scenario3.prefix,
        customerId: scenario3.customerId,
        locationId: scenario3.locationId,
        acUnitIds: scenario3.acUnitIds,
      })

      const techId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
      if (!techId) {
        testInfo.skip(true, 'technicianLead account missing')
        return
      }
      await assignLeadTechnician(orderId, techId)

      const ctx = await browser.newContext()
      try {
        const { page } = await loginAs(ctx, 'technicianLead')

        // Advance to EN_ROUTE only — do not proceed to IN_PROGRESS
        expect((await technicianTransition(page.request, orderId, 'EN_ROUTE')).status).toBe(200)

        // Attempt invalid transition: EN_ROUTE → COMPLETED (must pass through IN_PROGRESS first)
        const requestBody = { to_status: 'COMPLETED' }
        const { status: responseStatus, body: responseBody } = await technicianTransition(
          page.request,
          orderId,
          'COMPLETED'
        )

        expect(responseStatus).toBe(422)

        const supabase = getSupabaseAdmin()
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle()
        expect(order?.status).toBe('EN_ROUTE')

        const dir = evidenceDir('r19')
        mkdirSync(dir, { recursive: true })
        const evidence: CaseResult = {
          case: 3,
          description: 'EN_ROUTE to COMPLETED blocked (skips IN_PROGRESS)',
          requestBody,
          responseStatus,
          responseBody,
          finalStatus: order?.status ?? null,
        }
        writeFileSync(resolve(dir, 'case3.json'), JSON.stringify(evidence, null, 2))
        caseResults.push(evidence)
      } finally {
        await ctx.close()
      }
    }
  )

  qaTest(
    'R-19 case 4 — admin PATCH on terminal PAID order blocked',
    async ({ browser, qaAccounts: _qaAccounts }, testInfo) => {
      scenario4 = await seedFullScenario('r19-case4', { acUnits: 1, label: 'NegCase4' })
      const { orderId } = await seedOrder({
        prefix: scenario4.prefix,
        customerId: scenario4.customerId,
        locationId: scenario4.locationId,
        acUnitIds: scenario4.acUnitIds,
      })

      // Fast-forward directly to PAID via admin client, bypassing the state machine
      const supabase = getSupabaseAdmin()
      await supabase.from('orders').update({ status: 'PAID' }).eq('order_id', orderId)

      const ctx = await browser.newContext()
      try {
        const { page } = await loginAs(ctx, 'admin')

        const requestBody = { status: 'CANCELLED', cancellation_reason: 'QA test' }
        const res = await page.request.patch(`/api/orders/${orderId}`, {
          data: requestBody,
        })
        const responseStatus = res.status()
        const responseBody = await res.json().catch(() => ({}))

        expect([409, 422]).toContain(responseStatus)

        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle()
        expect(order?.status).toBe('PAID')

        const dir = evidenceDir('r19')
        mkdirSync(dir, { recursive: true })
        const evidence: CaseResult = {
          case: 4,
          description: 'Admin PATCH on terminal PAID order blocked',
          requestBody,
          responseStatus,
          responseBody,
          finalStatus: order?.status ?? null,
        }
        writeFileSync(resolve(dir, 'case4.json'), JSON.stringify(evidence, null, 2))
        caseResults.push(evidence)
      } finally {
        await ctx.close()
      }
    }
  )

  qaTest(
    'R-19 case 5 — helper technician cannot transition (only lead can)',
    async ({ browser, qaAccounts }, testInfo) => {
      scenario5 = await seedFullScenario('r19-case5', { acUnits: 1, label: 'NegCase5' })
      const { orderId } = await seedOrder({
        prefix: scenario5.prefix,
        customerId: scenario5.customerId,
        locationId: scenario5.locationId,
        acUnitIds: scenario5.acUnitIds,
      })

      const tech1Id = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
      const tech2Id = await getTechnicianIdByEmail(qaAccounts.technicianHelper.email)
      if (!tech1Id || !tech2Id) {
        testInfo.skip(true, 'technicianLead or technicianHelper account missing')
        return
      }

      // Assign tech1 as lead — sets order status to ASSIGNED
      await assignLeadTechnician(orderId, tech1Id)

      // Insert tech2 as helper via admin client (bypasses RLS)
      const supabase = getSupabaseAdmin()
      await supabase.from('order_technicians').insert({
        order_id: orderId,
        technician_id: tech2Id,
        role: 'helper',
      })

      const ctx = await browser.newContext()
      try {
        // Login as tech2 (helper role)
        const { page } = await loginAs(ctx, 'technicianHelper')

        const requestBody = { to_status: 'EN_ROUTE' }
        const { status: responseStatus, body: responseBody } = await technicianTransition(
          page.request,
          orderId,
          'EN_ROUTE'
        )

        expect(responseStatus).toBe(403)

        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('order_id', orderId)
          .maybeSingle()
        expect(order?.status).toBe('ASSIGNED')

        const dir = evidenceDir('r19')
        mkdirSync(dir, { recursive: true })
        const evidence: CaseResult = {
          case: 5,
          description: 'Helper technician cannot transition (only lead can)',
          requestBody,
          responseStatus,
          responseBody,
          finalStatus: order?.status ?? null,
        }
        writeFileSync(resolve(dir, 'case5.json'), JSON.stringify(evidence, null, 2))
        caseResults.push(evidence)
      } finally {
        await ctx.close()
      }
    }
  )
})
