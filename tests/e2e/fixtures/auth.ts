import { test as base, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Auth fixture for technician E2E tests.
 *
 * Reads test credentials from `.env.test.local` (gitignored). Falls back to
 * env vars. Tests are skipped if no credentials are configured so the suite
 * never silently runs against production data.
 *
 * Cookie reuse: each worker logs in once and reuses the storage state.
 */

type TestCreds = {
  email: string;
  password: string;
  baseURL?: string;
};

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envFile = loadDotEnv(resolve(process.cwd(), '.env.test.local'));

function getTechnicianCreds(): TestCreds | null {
  const email =
    envFile.TEST_TECHNICIAN_EMAIL ?? process.env.TEST_TECHNICIAN_EMAIL;
  const password =
    envFile.TEST_TECHNICIAN_PASSWORD ?? process.env.TEST_TECHNICIAN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function loginAsTechnician(page: Page, creds: TestCreds) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in|masuk|login/i }).click();
  // Wait until either redirected to /technician or /dashboard
  await page.waitForURL(/\/(technician|dashboard)/, { timeout: 30_000 });
  // Force technician scope
  if (!page.url().includes('/technician')) {
    await page.goto('/technician');
  }
  await page.waitForLoadState('networkidle');
}

type Fixtures = {
  technicianPage: Page;
  technicianCreds: TestCreds;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  technicianCreds: async ({}, use, testInfo) => {
    const creds = getTechnicianCreds();
    if (!creds) {
      testInfo.skip(
        true,
        'TEST_TECHNICIAN_EMAIL / TEST_TECHNICIAN_PASSWORD not set in .env.test.local'
      );
      return;
    }
    await use(creds);
  },
  technicianPage: async ({ page, technicianCreds }, use) => {
    await loginAsTechnician(page, technicianCreds);
    await use(page);
  },
});

export { expect } from '@playwright/test';
