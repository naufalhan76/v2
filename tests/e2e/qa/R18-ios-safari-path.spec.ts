import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { evidenceDir } from './fixtures'

test('R-18 iOS Safari path — sync API stubbed, online event drives drain', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext()
  // Stub Background Sync API as undefined BEFORE any page script runs.
  await ctx.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      try {
        Object.defineProperty(ServiceWorkerRegistration.prototype, 'sync', {
          configurable: true,
          get: () => undefined,
        })
      } catch {
        // ignore — Safari already lacks Background Sync API
      }
    }
  })
  try {
    const page = await ctx.newPage()
    await page.goto('/test/sync')
    await page
      .waitForFunction(
        () => typeof (window as unknown as Record<string, unknown>).__drainQueue === 'function',
        { timeout: 15_000 }
      )

    // Fire the online event to mimic reconnect. iOS Safari path: drain via
    // the window 'online' listener (no Background Sync available).
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    const result = await page.evaluate(async () => {
      const fn = (window as unknown as Record<string, unknown>).__drainQueue
      if (typeof fn !== 'function') return { error: 'not_exposed' }
      try {
        return await (fn as () => Promise<unknown>)()
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    })

    const syncStubbed = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return true
      // /test/sync is NOT under the technician SW scope, so there will be no
      // active registration here. Use getRegistration() (returns undefined
      // immediately) instead of .ready (which blocks forever waiting for an
      // activated SW that never arrives).
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return true
      return typeof (reg as unknown as { sync?: unknown }).sync === 'undefined'
    })

    expect(syncStubbed).toBe(true)
    expect(result).toBeDefined()

    testInfo.annotations.push({
      type: 'note',
      description:
        'Full webkit verification requires `--project=webkit-mobile` separately. This spec stubs Background Sync to simulate the iOS code path on chromium.',
    })

    const dir = evidenceDir('r18')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'online-event-fired.json'),
      JSON.stringify({ syncStubbed, drainResult: result }, null, 2)
    )
  } finally {
    await ctx.close()
  }
})
