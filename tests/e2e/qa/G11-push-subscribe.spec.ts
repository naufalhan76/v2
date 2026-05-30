/**
 * G11 — Push subscribe/unsubscribe API contract.
 *
 * Plan ref: .omo/plans/qa-e2e-business-process-gaps.md lines 894-947
 *
 * Scenarios:
 *   1. Subscribe lifecycle: POST /api/technician/push/subscribe → 201 →
 *      DB row exists → DELETE /api/technician/push/unsubscribe → 200 →
 *      DB row gone.
 *   2. Malformed subscribe body (missing keys) → 400 Zod validation.
 *
 * MUST NOT DO: real web-push delivery, notificationclick, SW push events.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  getSupabaseAdmin,
  evidenceDir,
  assertStagingHost,
  scenarioPrefix,
} from './fixtures'

const scenarioId = 'G11'
const prefix = scenarioPrefix(scenarioId)
const subscriptionEndpoint = `https://qa-e2e.example/push/${prefix.slice(-8)}`
const subscriptionKeys = {
  p256dh: 'BPWxVE4sBqLqK0oZJxQ1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t',
  auth: 'u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8',
}

/** Captured before subscribe for resilient afterAll purge. */
let endpointToPurge: string | null = subscriptionEndpoint

qaTest.beforeAll(async ({}, testInfo) => {
  assertStagingHost(testInfo.project.use.baseURL ?? '')
})

qaTest.afterAll(async () => {
  if (endpointToPurge) {
    const supabase = getSupabaseAdmin()
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpointToPurge)
  }
})

qaTest.describe.serial('G11 — Push subscribe/unsubscribe API contract', () => {
  qaTest('Subscribe lifecycle — persist then remove', async ({ context, qaAccounts: _qa }) => {
    const { page } = await loginAs(context, 'technicianLead')
    const supabase = getSupabaseAdmin()

    // ── 1. Subscribe ──
    const subRes = await page.request.post('/api/technician/push/subscribe', {
      data: {
        endpoint: subscriptionEndpoint,
        keys: subscriptionKeys,
        userAgent: 'qa',
      },
    })
    expect(subRes.status()).toBe(201)
    const subBody = await subRes.json()
    expect(subBody).toMatchObject({ success: true, data: { subscribed: true } })

    // ── 2. DB assert: row exists with correct fields ──
    const { data: subRow } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('endpoint', subscriptionEndpoint)
      .maybeSingle()
    expect(subRow).not.toBeNull()
    expect(subRow!.endpoint).toBe(subscriptionEndpoint)
    expect(subRow!.p256dh).toBe(subscriptionKeys.p256dh)
    expect(subRow!.auth).toBe(subscriptionKeys.auth)
    expect(subRow!.user_agent).toBe('qa')

    // ── 3. Unsubscribe ──
    const unsubRes = await page.request.delete('/api/technician/push/unsubscribe', {
      data: { endpoint: subscriptionEndpoint },
    })
    expect(unsubRes.status()).toBe(200)
    const unsubBody = await unsubRes.json()
    expect(unsubBody).toMatchObject({ success: true, data: { unsubscribed: true } })

    // ── 4. DB assert: row removed ──
    const { data: afterDelete } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('endpoint', subscriptionEndpoint)
      .maybeSingle()
    expect(afterDelete).toBeNull()

    // Already cleaned up — prevent afterAll re-delete on a missing row.
    endpointToPurge = null

    // ── Evidence ──
    const dir = evidenceDir(scenarioId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'subscribe-lifecycle.json'),
      JSON.stringify(
        {
          prefix,
          endpoint: subscriptionEndpoint,
          subscribe: subBody,
          subscribeDbRow: subRow,
          unsubscribe: unsubBody,
          afterDeleteDbRow: afterDelete,
        },
        null,
        2
      )
    )
  })

  qaTest('Malformed subscribe body → 400', async ({ context, qaAccounts: _qa }) => {
    const { page } = await loginAs(context, 'technicianLead')

    const res = await page.request.post('/api/technician/push/subscribe', {
      data: { endpoint: 'not-a-url' },
    })
    expect(res.status()).toBe(400)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    // Staging returns "Invalid payload: Invalid url" when endpoint is malformed
    expect(body.error).toMatch(/keys|Required|Invalid/i)

    // ── Evidence ──
    const dir = evidenceDir(scenarioId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'malformed-400.json'),
      JSON.stringify(
        {
          prefix,
          sent: { endpoint: 'not-a-url' },
          status: res.status(),
          body,
        },
        null,
        2
      )
    )
  })
})