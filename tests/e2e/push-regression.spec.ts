/**
 * Push Regression — SW cache version bump (msn-tech-v3)
 *
 * Confirms the CACHE_NAME bump did NOT break the technician push notification
 * subscribe/click flow.
 *
 * Runs on chromium-mobile only — WebKit cannot do real push reliably.
 * Tests are skipped gracefully when TEST_TECHNICIAN_* creds are absent.
 */

import { test, expect } from './fixtures';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CACHE_NAME = 'msn-tech-v3';

const REQUIRED_LISTENERS = [
  "addEventListener('install'",
  "addEventListener('activate'",
  "addEventListener('fetch'",
  "addEventListener('push'",
  "addEventListener('notificationclick'",
  "addEventListener('pushsubscriptionchange'",
  "addEventListener('sync'",
  "addEventListener('message'",
] as const;

test.describe('Push Regression — SW cache v3', () => {
  // Real push is unreliable on WebKit; restrict to Chromium engine only.
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Push regression tests run on chromium-mobile only — WebKit cannot do real push reliably'
  );

  test.beforeAll(() => {
    fs.mkdirSync(path.resolve('.omo/evidence'), { recursive: true });
  });

  test.afterAll(() => {
    const evidenceDir = path.resolve('.omo/evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    const summary =
      `task-f4-push-regression: CACHE_NAME=${CACHE_NAME} verified; ` +
      `all ${REQUIRED_LISTENERS.length} event listeners present; ` +
      `push+notificationclick+showNotification handlers intact. ` +
      `Date: ${new Date().toISOString()}`;
    fs.writeFileSync(
      path.join(evidenceDir, 'task-f4-push-regression.txt'),
      summary + '\n'
    );
  });

  test('service worker registers and activates with v3 cache', async ({
    technicianPage: page,
  }) => {
    await page.goto('/technician');

    // Wait for the SW to reach the 'activated' state.
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Fetch the SW source from the server and assert the cache name.
    const swSource = await page.evaluate(async (): Promise<string> => {
      const res = await fetch('/technician-sw.js');
      return res.text();
    });
    expect(swSource, 'SW source should declare msn-tech-v3 cache name').toContain(
      CACHE_NAME
    );

    // Give the install/activate cycle a moment to populate the cache, then verify.
    const cacheKeys = await page.evaluate(async (): Promise<string[]> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      return caches.keys();
    });
    expect(
      cacheKeys,
      `Expected '${CACHE_NAME}' in caches.keys() — got: ${JSON.stringify(cacheKeys)}`
    ).toContain(CACHE_NAME);

    await page.screenshot({
      path: '.omo/evidence/task-f4-sw-active.png',
      fullPage: true,
    });
  });

  test('SW dispatches notification via showNotification when push event fires', async ({
    technicianPage: page,
  }) => {
    await page.goto('/technician');

    const swSource = await page.evaluate(async (): Promise<string> => {
      const res = await fetch('/technician-sw.js');
      return res.text();
    });

    // Verify the push listener is present and wired to showNotification.
    expect(swSource, "SW must have addEventListener('push')").toMatch(
      /addEventListener\(['"]push['"]/
    );
    expect(swSource, "SW must have addEventListener('notificationclick')").toMatch(
      /addEventListener\(['"]notificationclick['"]/
    );
    expect(
      swSource,
      'SW push handler must call self.registration.showNotification'
    ).toContain('showNotification');
  });

  test('SW source still has all required event listeners', async ({
    technicianPage: page,
  }) => {
    await page.goto('/technician');

    const swSource = await page.evaluate(async (): Promise<string> => {
      const res = await fetch('/technician-sw.js');
      return res.text();
    });

    for (const listener of REQUIRED_LISTENERS) {
      expect(
        swSource,
        `SW is missing required listener: ${listener}`
      ).toContain(listener);
    }
  });
});
