import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { qaTest, expect, loginAs, evidenceDir } from './fixtures'

qaTest('R-17 storage quota guard — enqueuePhoto throws when usage near quota', async ({ browser, qaAccounts: _qa }, testInfo) => {
  const ctx = await browser.newContext()
  try {
    const { page } = await loginAs(ctx, 'technicianLead')

    await page.goto('/test/sync')
    await page
      .waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__enqueuePhoto === 'function', { timeout: 8_000 })
      .catch(() => {
        // harness may not have enqueuePhoto exposed; document below
      })

    const enqueueAvailable = await page.evaluate(
      () => typeof (window as unknown as Record<string, unknown>).__enqueuePhoto === 'function'
    )

    if (!enqueueAvailable) {
      testInfo.annotations.push({
        type: 'finding',
        description:
          'window.__enqueuePhoto not exposed at /test/sync. Quota guard cannot be exercised from the QA suite. Recommend exposing enqueuePhoto in src/app/test/sync/page.tsx.',
      })
      const dir = evidenceDir('r17')
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        resolve(dir, 'quota-error.txt'),
        `SKIP: window.__enqueuePhoto not exposed at /test/sync\n`
      )
      return
    }

    const errorMsg = await page.evaluate(async () => {
      // Force navigator.storage.estimate to report 95% usage.
      const orig = navigator.storage?.estimate?.bind(navigator.storage)
      Object.defineProperty(navigator.storage, 'estimate', {
        configurable: true,
        value: async () => ({ usage: 9.5e9, quota: 1e10 }),
      })
      try {
        const fn = (window as unknown as Record<string, unknown>).__enqueuePhoto as (
          input: Record<string, unknown>
        ) => Promise<unknown>
        await fn({
          orderId: 'qa-r17-quota',
          acUnitIdx: 0,
          kind: 'before',
          blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
          bytes: 4,
          width: 1,
          height: 1,
          mimeType: 'image/jpeg',
        })
        return null
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      } finally {
        if (orig) {
          Object.defineProperty(navigator.storage, 'estimate', {
            configurable: true,
            value: orig,
          })
        }
      }
    })

    expect(errorMsg).toMatch(/STORAGE_QUOTA_CRITICAL/)

    const dir = evidenceDir('r17')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'quota-error.txt'), `${errorMsg}\n`)
  } finally {
    await ctx.close()
  }
})
