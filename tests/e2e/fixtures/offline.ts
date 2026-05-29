import type { BrowserContext, Page } from '@playwright/test';

/**
 * Offline / online toggle helpers.
 *
 * `context.setOffline()` flips the network state and synthesizes the
 * appropriate `online` / `offline` events on every page in the context, which
 * is what our `useOnlineSync` hook listens to.
 */

export async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
  for (const page of context.pages()) {
    await page
      .evaluate(() => {
        window.dispatchEvent(new Event('offline'));
      })
      .catch(() => {});
  }
}

export async function goOnline(context: BrowserContext) {
  await context.setOffline(false);
  for (const page of context.pages()) {
    await page
      .evaluate(() => {
        window.dispatchEvent(new Event('online'));
      })
      .catch(() => {});
  }
}

export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) {
      await new Promise<void>((resolve) => {
        const installing = reg.installing ?? reg.waiting;
        if (!installing) return resolve();
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') resolve();
        });
      });
    }
  });
}
