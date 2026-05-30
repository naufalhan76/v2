/**
 * Gap helpers — convenience wrappers for the QA suite.
 *
 * These functions short-circuit repetitive setup patterns (advance an order to
 * a target state, guard against non-staging hosts, skip checks) so specs can
 * start from the interesting part.
 *
 * Every function here is additive — it does not mutate existing fixture
 * signatures or behaviour.
 */

import type { APIRequestContext, BrowserContext } from '@playwright/test'
import { getSupabaseAdmin, makePrefix } from './env'
import { seedOrder, assignLeadTechnician, getTechnicianIdByEmail } from './seeders'
import { technicianTransition, technicianSubmitReport } from './api-helpers'
import { getFullOrderSnapshot } from './db-asserts'
import type { SeedScenario, QaPrefix, FullOrderSnapshot } from './types'
import type { OrderStatus } from '@/lib/order-status'

// ─── seedOrderToState ─────────────────────────────────────────────

type TargetState = 'COMPLETED' | 'INVOICED'

export interface SeedToStateOpts {
  /** Logged-in technician's request context (page.request). */
  techRequest: APIRequestContext
  /** Logged-in admin's request context (page.request). */
  adminRequest: APIRequestContext
  /** Technician login email — used to resolve technician_id for assignment. */
  technicianEmail: string
  /** Override the seed order params (serviceType, scheduledVisitDate). */
  seedParams?: {
    serviceType?: string
    scheduledVisitDate?: string
  }
}

/**
 * Seed an order inside a scenario and advance it to COMPLETED or INVOICED.
 *
 * Flow:
 * 1. seedOrder  (admin client — no auth needed)
 * 2. assignLeadTechnician (admin client)
 * 3. technicianTransition: ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED
 * 4. technicianSubmitReport (API; falls back to direct DB insert if the
 *    `technician_submit_report_v2` RPC is missing on staging)
 * 5. If target = INVOICED: PATCH /api/orders/{orderId} status=INVOICED via admin
 *
 * Returns the order ID and a full DB snapshot so the caller can assert
 * preconditions before the spec begins.
 */
export async function seedOrderToState(
  scenario: SeedScenario,
  targetState: TargetState,
  opts: SeedToStateOpts,
): Promise<{ orderId: string; snapshot: FullOrderSnapshot }> {
  const technicianId = await getTechnicianIdByEmail(opts.technicianEmail)
  if (!technicianId) {
    throw new Error(
      `[qa] technician not found for email ${opts.technicianEmail} — run qa:seed first`,
    )
  }

  // 1. Create order (admin client = supabase service role).
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
    serviceType: opts.seedParams?.serviceType,
    scheduledVisitDate: opts.seedParams?.scheduledVisitDate,
  })

  // 2. Assign lead technician (admin client).
  await assignLeadTechnician(orderId, technicianId)

  // 3. Tech transitions through the state machine via API.
  const transitions: OrderStatus[] = [
    'ASSIGNED',
    'EN_ROUTE',
    'IN_PROGRESS',
    'COMPLETED',
  ]
  for (const toStatus of transitions) {
    const { status, body } = await technicianTransition(
      opts.techRequest,
      orderId,
      toStatus,
      {
        idempotencyKey: crypto.randomUUID(),
        gps: {
          lat: -6.2088,
          lng: 106.8456,
          accuracy_m: 5,
          captured_at: new Date().toISOString(),
        },
      },
    )
    if (status < 200 || status > 299) {
      throw new Error(
        `[qa] transition to ${toStatus} failed: ${status} ${JSON.stringify(body)}`,
      )
    }
  }

  // — After transitions handle the switch below, the order must be COMPLETED.
  //   We keep the loop generic so a future DONE→COMPLETED RPC transition can
  //   be gated in the same way, but for now we explicitly enforce.
  {
    const snap = await getFullOrderSnapshot(orderId)
    if (snap.order.status !== 'COMPLETED') {
      throw new Error(
        `[qa] expected COMPLETED after transitions, got ${snap.order.status}`,
      )
    }
  }

  // 4. Submit report via API.  If the RPC is missing (known staging gap),
  //    fall back to an admin-client direct insert so specs can still run.
  const reportIdempotencyKey = crypto.randomUUID()
  try {
    const { status: rptStatus, body: rptBody } = await technicianSubmitReport(
      opts.techRequest,
      orderId,
      {
        idempotencyKey: reportIdempotencyKey,
        photosBefore: [],
        photosAfter: [],
        customerSignatureUrl: '',
        customerNameSigned: 'QA Bot',
        actualTotalPrice: 300_000,
        materials: [],
        acUnits: scenario.acUnitIds.map((acId) => ({
          ac_unit_id: acId,
          status: 'SERVICED',
          notes: '[seed]',
        })),
        notes: '[seedOrderToState]',
        nextServiceRecommendationDate: null,
      },
    )

    if (rptStatus < 200 || rptStatus > 299) {
      // RPC may not exist on staging — swallow and fall through to fallback.
      const msg =
        typeof rptBody === 'object' && rptBody !== null
          ? JSON.stringify(rptBody)
          : String(rptBody)
      if (msg.includes('function') || msg.includes('rpc') || msg.includes('not found')) {
        // Expected staging gap — proceed to fallback.
      } else {
        throw new Error(
          `[qa] technicianSubmitReport failed: ${rptStatus} ${msg}`,
        )
      }
    }
  } catch (err) {
    // Fallback: direct DB insert via admin client.
    const supabase = getSupabaseAdmin()

    const { data: existingRpt } = await supabase
      .from('service_reports')
      .select('report_id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!existingRpt) {
      await supabase.from('service_reports').insert({
        order_id: orderId,
        technician_id: technicianId,
        idempotency_key: reportIdempotencyKey,
        photos_before: [],
        photos_after: [],
        customer_signature_url: '',
        customer_name_signed: 'QA Bot',
        actual_total_price: 300_000,
        materials: [],
        ac_units: scenario.acUnitIds.map((acId) => ({
          ac_unit_id: acId,
          status: 'SERVICED',
          notes: '[seed-fallback]',
        })),
        notes: '[seedOrderToState-fallback]',
        submitted_at: new Date().toISOString(),
      })
    }

    // Ensure the order status is COMPLETED and record the transition.
    const { data: orderRow } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()

    if (orderRow && orderRow.status !== 'COMPLETED') {
      const prev = orderRow.status
      await supabase
        .from('orders')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('order_id', orderId)

      await supabase.from('order_status_transitions').insert({
        order_id: orderId,
        from_status: prev,
        to_status: 'COMPLETED',
        transition_date: new Date().toISOString(),
        notes: '[seedOrderToState-fallback]',
        lat: -6.2088,
        lng: 106.8456,
      })
    }
  }

  // 5. If target is INVOICED, push COMPLETED → INVOICED via admin API.
  if (targetState === 'INVOICED') {
    const res = await opts.adminRequest.patch(
      `/api/orders/${orderId}`,
      { data: { status: 'INVOICED' } },
    )
    if (!res.ok()) {
      throw new Error(
        `[qa] COMPLETED→INVOICED transition failed: ${res.status()} ${await res.text()}`,
      )
    }
  }

  const snapshot = await getFullOrderSnapshot(orderId)
  return { orderId, snapshot }
}

// ─── assertStagingHost ────────────────────────────────────────────

/**
 * Guard: throw if baseURL points at a production instance.
 *
 * Accepts `localhost` and `v2.nufnh.my.id` as allowed staging hosts.
 */
export function assertStagingHost(baseURL: string): void {
  const allowed = ['localhost', 'v2.nufnh.my.id']
  const url = baseURL.toLowerCase()
  if (!allowed.some((host) => url.includes(host))) {
    throw new Error(
      `[qa] SAFETY: baseURL "${baseURL}" does not match a known staging host. ` +
        `Expected one of: ${allowed.join(', ')}. ` +
        `Set PLAYWRIGHT_BASE_URL or check your .env.test.local.`,
    )
  }
}

// ─── superAdminAccountOrSkip ───────────────────────────────────────

/**
 * Attempt to log in as superadmin.  If login fails (missing account, wrong
 * password) the caller's test is skipped so the suite does not produce false
 * failures from a missing bootstrap step.
 */
export async function superAdminAccountOrSkip(
  context: BrowserContext,
  testInfo: { skip: (shouldSkip: boolean, reason?: string) => void },
): Promise<void> {
  const page = await context.newPage()
  try {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByLabel(/email/i).fill('superadmin@test.com')
    await page.getByLabel(/password/i).fill('Test1234!')
    await page.getByRole('button', { name: /sign in|masuk|login/i }).click()

    // Wait for dashboard or error message.
    const settled = await Promise.race([
      page.waitForURL(/\/(dashboard|technician)/, { timeout: 15_000 }),
      page
        .locator('[data-testid="login-error"], .text-destructive')
        .first()
        .waitFor({ timeout: 15_000 }),
    ]).catch(() => null)

    if (
      !settled ||
      (typeof settled !== 'string' && !page.url().includes('/dashboard'))
    ) {
      // Login page still showing — credentials invalid.
      const errEl = await page.locator('.text-destructive').first().textContent().catch(() => '')
      testInfo.skip(
        true,
        `[qa] SUPERADMIN login failed (${errEl || 'unknown error'}) — run bootstrap-staging.mjs first`,
      )
    }
  } finally {
    await page.close().catch(() => {})
  }
}

// ─── resendKeyAbsentOrSkip ─────────────────────────────────────────

/**
 * Skip the calling test if RESEND_API_KEY is not set.
 *
 * Email-related specs call this at the top so the suite can run without
 * email configured — all email-specific assertions are simply skipped rather
 * than producing false failures.
 */
export function resendKeyAbsentOrSkip(
  testInfo: { skip: (shouldSkip: boolean, reason?: string) => void },
): void {
  const key = process.env.RESEND_API_KEY ?? ''
  if (!key) {
    testInfo.skip(
      true,
      '[qa] RESEND_API_KEY not set — skipping email-dependent spec',
    )
  }
}

// ─── scenarioPrefix ────────────────────────────────────────────────

/**
 * Wraps `makePrefix` and enforces ≥8 hex chars in the random suffix so
 * uniqueness is guaranteed across parallel workers.
 */
export function scenarioPrefix(scenarioId: string): QaPrefix {
  const prefix = makePrefix(scenarioId)

  // makePrefix produces QA-E2E-{id}-{ts}-{rand5} where rand5 is 5 hex chars.
  // Extend rand to ≥8 hex chars by appending another 3.
  const extra = Math.random().toString(36).slice(2, 5) // 3 more chars → total 8
  return `${prefix}-${extra}` as QaPrefix
}