/**
 * API Contract tests — T4 multi-AC + idempotency
 *
 * Uses the `technicianPage` fixture so every test is automatically skipped
 * when TEST_TECHNICIAN_EMAIL / TEST_TECHNICIAN_PASSWORD are absent from
 * .env.test.local. Authenticated cookies are inherited by page.request so
 * all fetch calls below run in the technician's session.
 *
 * Evidence files are written to .omo/evidence/ for audit.
 */

import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from './fixtures'
import { findAssignedOrder } from './fixtures/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = resolve(process.cwd(), '.omo/evidence')

function saveEvidence(filename: string, lines: string[]): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(resolve(EVIDENCE_DIR, filename), lines.join('\n') + '\n', 'utf-8')
}

/** Minimal valid report body — only ac_units is intentionally broken per test. */
function baseReportBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idempotency_key: randomUUID(),
    photos_before: ['https://example.com/before.jpg'],
    photos_after: ['https://example.com/after.jpg'],
    materials: [],
    actual_total_price: 0,
    customer_signature_url: 'sig/test.png',
    customer_name_signed: 'Test User',
    ac_units: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('API Contract — T4 multi-AC + idempotency', () => {
  // -------------------------------------------------------------------------
  // 1. Schema validation: invalid ac_units item
  // -------------------------------------------------------------------------
  test('rejects report with invalid ac_units payload', async ({ technicianPage: page }) => {
    // Use a random UUID as the order id — Zod validation fires before any DB
    // lookup so the order does not need to exist.
    const orderId = randomUUID()

    const body = baseReportBody({
      ac_units: [
        {
          // Neither ac_unit_id nor brand provided, and skipped is false.
          // AcUnitReportItemSchema.refine() must reject this.
          skipped: false,
          photos_before: [],
          photos_after: [],
          materials_used: [],
        },
      ],
    })

    const response = await page.request.post(
      `/api/technician/jobs/${orderId}/report`,
      { data: body }
    )

    const json = await response.json()
    const errorMsg = String(json.error ?? json.message ?? '').toLowerCase()

    saveEvidence('task-4-api-validation.txt', [
      `status: ${response.status()}`,
      `error: ${json.error ?? json.message ?? JSON.stringify(json)}`,
    ])

    expect(response.status()).toBe(400)
    expect(errorMsg).toContain('ac_units')
  })

  // -------------------------------------------------------------------------
  // 2. Idempotent transition replay
  // -------------------------------------------------------------------------
  test('idempotent transition replay', async ({ technicianPage: page }, testInfo) => {
    const orderId = await findAssignedOrder(page)

    if (!orderId) {
      saveEvidence('task-4-idempotency.txt', [
        'result: skipped — no assigned order found via /api/technician/jobs/today',
      ])
      testInfo.skip(true, 'No assigned order found for technician — skipping idempotency test')
      return
    }

    const idempotencyKey = randomUUID()
    const body = {
      to_status: 'EN_ROUTE',
      idempotency_key: idempotencyKey,
      gps: null,
    }

    // First call
    const first = await page.request.post(
      `/api/technician/jobs/${orderId}/transition`,
      { data: body }
    )
    const firstStatus = first.status()
    const firstJson = await first.json()

    const evidence: string[] = [
      `order_id: ${orderId}`,
      `idempotency_key: ${idempotencyKey}`,
      `first_call_status: ${firstStatus}`,
      `first_call_body: ${JSON.stringify(firstJson)}`,
    ]

    // If the order isn't in a transitionable state, skip rather than fail.
    if ([403, 404, 422].includes(firstStatus)) {
      evidence.push(
        `result: skipped — order not in transitionable state (HTTP ${firstStatus})`
      )
      saveEvidence('task-4-idempotency.txt', evidence)
      testInfo.skip(
        true,
        `Order ${orderId} not in a transitionable state (HTTP ${firstStatus}) — skipping`
      )
      return
    }

    // Second call — identical body, same idempotency_key
    const second = await page.request.post(
      `/api/technician/jobs/${orderId}/transition`,
      { data: body }
    )
    const secondStatus = second.status()
    const secondJson = await second.json()

    evidence.push(
      `second_call_status: ${secondStatus}`,
      `second_call_body: ${JSON.stringify(secondJson)}`,
    )

    const replay = secondJson?.data?.idempotent_replay ?? secondJson?.idempotent_replay

    if (replay === true) {
      evidence.push('result: idempotent_replay confirmed')
    } else {
      evidence.push(`result: UNEXPECTED — idempotent_replay not true in response`)
    }

    saveEvidence('task-4-idempotency.txt', evidence)

    expect(secondStatus).toBe(200)
    expect(replay).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 3. Schema validation: out-of-range GPS coordinates
  // -------------------------------------------------------------------------
  test('rejects transition with malformed gps', async ({ technicianPage: page }) => {
    // lat: 999 exceeds GpsCaptureSchema max(90) — validation fires before any
    // DB lookup so the order id does not need to exist.
    const orderId = randomUUID()

    const response = await page.request.post(
      `/api/technician/jobs/${orderId}/transition`,
      {
        data: {
          to_status: 'EN_ROUTE',
          idempotency_key: randomUUID(),
          gps: { lat: 999, lng: 0 },
        },
      }
    )

    expect(response.status()).toBe(400)
  })
})
