/**
 * Realtime dual-context helper — used by R-01 to verify Supabase realtime
 * cache invalidation across two browser sessions (admin + technician).
 */

import { type Browser, type BrowserContext } from '@playwright/test'

export type DualContext = {
  adminContext: BrowserContext
  technicianContext: BrowserContext
  close: () => Promise<void>
}

export async function openDualContexts(browser: Browser): Promise<DualContext> {
  const adminContext = await browser.newContext()
  const technicianContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    permissions: ['geolocation'],
    geolocation: { latitude: -6.2088, longitude: 106.8456 },
  })
  return {
    adminContext,
    technicianContext,
    close: async () => {
      await Promise.all([adminContext.close(), technicianContext.close()])
    },
  }
}

/**
 * Wait for an element on a page to reflect a change driven by a realtime
 * channel from another page. Polls up to `timeout` ms.
 */
export async function waitForRealtimeUpdate(
  page: import('@playwright/test').Page,
  predicate: () => Promise<boolean>,
  timeout = 15_000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await predicate()) return
    await page.waitForTimeout(500)
  }
  throw new Error('[qa] waitForRealtimeUpdate timed out')
}
