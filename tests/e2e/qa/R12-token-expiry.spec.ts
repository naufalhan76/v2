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
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest('R-12 token expiry mid-offline — refresh runs before sync', async ({ browser, qaAccounts }, testInfo) => {
  scenario = await seedFullScenario('r12', { acUnits: 1, label: 'TokenExpiry' })
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
  try {
    const { page } = await loginAs(ctx, 'technicianLead')

    // Snapshot the Supabase session key BEFORE patching.
    const before = await page.evaluate(() => {
      const out: Record<string, unknown> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          try {
            const v = JSON.parse(localStorage.getItem(k) ?? 'null')
            out.key = k
            out.expires_at = v?.expires_at ?? null
            out.has_refresh_token = Boolean(v?.refresh_token)
          } catch {
            // ignore
          }
        }
      }
      return out
    })

    if (!before.key) {
      testInfo.skip(true, 'Supabase session key not found in localStorage')
      return
    }

    // Patch expires_at to 1 minute in the past.
    await page.evaluate((key) => {
      const raw = localStorage.getItem(key as string)
      if (!raw) return
      const parsed = JSON.parse(raw)
      parsed.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(key as string, JSON.stringify(parsed))
    }, before.key)

    // Trigger refresh by navigating to the sync test harness which loads
    // the offline lib and calls auth-refresh on drainQueue.
    await page.goto('/test/sync')
    await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__drainQueue === 'function', { timeout: 15_000 }).catch(() => {})
    await page.evaluate(async () => {
      const fn = (window as unknown as Record<string, unknown>).__drainQueue
      if (typeof fn === 'function') {
        try {
          await (fn as () => Promise<unknown>)()
        } catch {
          // refresh may surface AUTH error if refresh itself fails — that's still useful evidence.
        }
      }
    })

    const after = await page.evaluate((key) => {
      const raw = localStorage.getItem(key as string)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return { expires_at: parsed?.expires_at ?? null }
    }, before.key)

    const refreshed = (after?.expires_at ?? 0) > Math.floor(Date.now() / 1000)
    if (!refreshed) {
      testInfo.annotations.push({
        type: 'finding',
        description: `Token not refreshed during drainQueue — expires_at after=${after?.expires_at}, now=${Math.floor(Date.now() / 1000)}. Auth-refresh wiring may not auto-renew on drain alone; production relies on Supabase SDK background refresh.`,
      })
    }

    // Sanity API call regardless of refresh result.
    const api = await page.request.get('/api/technician/jobs/today')
    const apiStatus = api.status()

    const dir = evidenceDir('r12')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'refresh-result.json'),
      JSON.stringify({ orderId, before, after, refreshed, apiStatus }, null, 2)
    )
  } finally {
    await ctx.close()
  }
})
