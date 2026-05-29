/**
 * Role-aware login helpers. Mirrors the existing tests/e2e/fixtures/auth.ts
 * pattern but parameterised by role so a single spec can drive multiple
 * sessions (admin + technician + finance).
 */

import { test as base, type BrowserContext, type Page } from '@playwright/test'
import { loadQaAccounts } from './env'
import type { QaAccounts, QaRoleAccount } from './types'

export type QaRole = keyof QaAccounts

async function loginPage(
  page: Page,
  account: QaRoleAccount,
  expectedPathRegex: RegExp
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(account.email)
  await page.getByLabel(/password/i).fill(account.password)
  await page.getByRole('button', { name: /sign in|masuk|login/i }).click()
  await page.waitForURL(expectedPathRegex, { timeout: 30_000 })
  await page
    .locator('[data-testid="dashboard-shell"], [data-testid="today-jobs-section"], [data-testid="today-jobs-empty"], [data-testid="technician-home"]')
    .first()
    .waitFor({ timeout: 15_000 })
}

export async function loginAs(
  context: BrowserContext,
  role: QaRole
): Promise<{ page: Page; account: QaRoleAccount }> {
  const accounts = loadQaAccounts()
  if (!accounts) {
    throw new Error(
      '[qa] QA_* credentials not configured — run scripts/seed-qa-accounts.ts first'
    )
  }
  const account = accounts[role]
  const page = await context.newPage()

  if (role === 'technicianLead' || role === 'technicianHelper') {
    await loginPage(page, account, /\/(technician|dashboard)/)
    if (!page.url().includes('/technician')) {
      await page.goto('/technician')
    }
  } else {
    await loginPage(page, account, /\/(dashboard|technician)/)
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
  }
  await page
    .locator('[data-testid="dashboard-shell"], [data-testid="today-jobs-section"], [data-testid="today-jobs-empty"], [data-testid="technician-home"]')
    .first()
    .waitFor({ timeout: 15_000 })
  return { page, account }
}

type Fixtures = {
  qaAccounts: QaAccounts
}

export const qaTest = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  qaAccounts: async ({}, use, testInfo) => {
    const accounts = loadQaAccounts()
    if (!accounts) {
      testInfo.skip(
        true,
        'QA_* credentials missing — run scripts/seed-qa-accounts.ts'
      )
      return
    }
    await use(accounts)
  },
})

export { expect } from '@playwright/test'
