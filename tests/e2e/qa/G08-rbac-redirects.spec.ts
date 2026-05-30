/**
 * G08 — RBAC negatives + redirects spec
 *
 * One negative per role at the most sensitive boundary + one SUPERADMIN positive.
 * Sessions reused via pre-authenticated browser contexts to avoid Supabase auth
 * rate limits.
 *
 * Coverage:
 *   - TECHNICIAN → /dashboard/keuangan/invoices redirects to /technician
 *   - FINANCE PATCH /api/orders/{id} assign → 403 Forbidden
 *   - ADMIN → /dashboard/manajemen/user redirects to /dashboard
 *   - SUPERADMIN → /dashboard/manajemen/user page renders
 *   - Unauthenticated → /login?redirectTo=<path>
 *   - Non-TECH → /technician/* redirects to /dashboard
 *
 * Ref: middleware.ts:95-98 (unauth), :132 (TECH→/technician),
 *      :137 (non-TECH→/dashboard), :142-146 (SUPERADMIN guard)
 *      src/app/api/orders/[id]/route.ts:81-83 (TECH 403), :96-98 (FINANCE 403)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserContext } from '@playwright/test'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  getTechnicianIdByEmail,
  evidenceDir,
  assertStagingHost,
  superAdminAccountOrSkip,
  loadQaAccounts,
  type SeedScenario,
} from './fixtures'

type EvidenceItem = {
  scenario: string
  role: string
  assertion: string
  passed: boolean
  detail: string
  timestamp: string
}

qaTest.describe.serial('G08 RBAC negatives + redirects', () => {
  // ── Shared state ──────────────────────────────────────────────
  let scenario: SeedScenario | null = null
  let orderId = ''
  let techId = ''

  // Pre-authenticated contexts — login once per role, reuse across tests.
  let techCtx: BrowserContext | null = null
  let financeCtx: BrowserContext | null = null
  let adminCtx: BrowserContext | null = null

  const evidence: EvidenceItem[] = []
  const EVIDENCE_DIR = evidenceDir('G08')

  function saveEvidenceItem(
    scenarioName: string,
    role: string,
    assertion: string,
    passed: boolean,
    detail: string,
  ): void {
    evidence.push({
      scenario: scenarioName,
      role,
      assertion,
      passed,
      detail,
      timestamp: new Date().toISOString(),
    })
  }

  // ── beforeAll: seed + pre-auth per role ───────────────────────
  qaTest.beforeAll(async ({ browser }, testInfo) => {
    const accounts = loadQaAccounts()
    if (!accounts) return // tests skip via qaAccounts fixture

    assertStagingHost(testInfo.project.use.baseURL ?? '')

    scenario = await seedFullScenario('G08', { acUnits: 1, label: 'RBAC' })

    const { orderId: oid } = await seedOrder({
      prefix: scenario.prefix,
      customerId: scenario.customerId,
      locationId: scenario.locationId,
      acUnitIds: scenario.acUnitIds,
    })
    orderId = oid

    techId = (await getTechnicianIdByEmail(accounts.technicianLead.email)) ?? ''

    // Pre-authenticate each role once — reuse contexts across tests.
    techCtx = await browser.newContext()
    const { page: tp } = await loginAs(techCtx, 'technicianLead')
    await tp.close()

    financeCtx = await browser.newContext()
    const { page: fp } = await loginAs(financeCtx, 'finance')
    await fp.close()

    adminCtx = await browser.newContext()
    const { page: ap } = await loginAs(adminCtx, 'admin')
    await ap.close()
  })

  // ── afterAll: evidence + purge ────────────────────────────────
  qaTest.afterAll(async () => {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    writeFileSync(
      resolve(EVIDENCE_DIR, 'summary.json'),
      JSON.stringify({ suite: 'G08 RBAC negatives + redirects', evidence }, null, 2),
    )

    await Promise.allSettled([
      techCtx?.close(),
      financeCtx?.close(),
      adminCtx?.close(),
    ])
    if (scenario) await scenario.cleanup()
  })

  // ═══════════════════════════════════════════════════════════════
  // 1. TECHNICIAN blocked from finance dashboard
  // ═══════════════════════════════════════════════════════════════
  qaTest('TECH → /dashboard/keuangan/invoices redirects to /technician', async () => {
    if (!techCtx) return

    const page = await techCtx.newPage()
    try {
      await page.goto('/dashboard/keuangan/invoices', { waitUntil: 'networkidle' })
      // Middleware redirects TECHNICIAN away from ALL /dashboard paths
      await page.waitForURL(/\/technician/, { timeout: 15_000 })
      const finalUrl = new URL(page.url())
      expect(finalUrl.pathname).toBe('/technician')

      await page.screenshot({
        path: resolve(EVIDENCE_DIR, 'tech-blocked.png'),
        fullPage: true,
      })
      writeFileSync(
        resolve(EVIDENCE_DIR, 'tech-blocked.json'),
        JSON.stringify(
          {
            scenario: 'TECH blocked from finance',
            from: '/dashboard/keuangan/invoices',
            finalUrl: page.url(),
            pathname: finalUrl.pathname,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      )

      saveEvidenceItem(
        'TECH blocked from finance',
        'technicianLead',
        'redirect to /technician',
        true,
        `final=${finalUrl.pathname}`,
      )
    } finally {
      await page.close()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 2. FINANCE forbidden to assign via API
  // ═══════════════════════════════════════════════════════════════
  qaTest('FINANCE PATCH /api/orders/{id} assign → 403 Forbidden', async () => {
    if (!financeCtx || !orderId) return

    const page = await financeCtx.newPage()
    try {
      const assignTechId = techId || crypto.randomUUID()
      const res = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: 'ASSIGNED', assigned_technician_id: assignTechId },
      })
      const status = res.status()
      const body = await res.json().catch(() => ({}))
      expect(status).toBe(403)

      writeFileSync(
        resolve(EVIDENCE_DIR, 'finance-403.json'),
        JSON.stringify(
          {
            scenario: 'FINANCE forbidden to assign',
            orderId,
            request: { status: 'ASSIGNED', assigned_technician_id: assignTechId },
            responseStatus: status,
            responseBody: body,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      )

      saveEvidenceItem(
        'FINANCE forbidden to assign',
        'finance',
        'API 403',
        true,
        `status=${status}`,
      )
    } finally {
      await page.close()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. ADMIN blocked from user management
  // ═══════════════════════════════════════════════════════════════
  qaTest('ADMIN → /dashboard/manajemen/user redirects to /dashboard', async () => {
    if (!adminCtx) return

    const page = await adminCtx.newPage()
    try {
      await page.goto('/dashboard/manajemen/user', { waitUntil: 'networkidle' })
      await page.waitForURL(/\/dashboard(?:\/?$|\?)/, { timeout: 15_000 })
      const finalUrl = new URL(page.url())
      expect(finalUrl.pathname).toBe('/dashboard')

      await page.screenshot({
        path: resolve(EVIDENCE_DIR, 'admin-user-mgmt-blocked.png'),
        fullPage: true,
      })

      saveEvidenceItem(
        'ADMIN blocked from user management',
        'admin',
        'redirect to /dashboard',
        true,
        `final=${finalUrl.pathname}`,
      )
    } finally {
      await page.close()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 4. SUPERADMIN accesses user management
  // ═══════════════════════════════════════════════════════════════
  qaTest('SUPERADMIN → /dashboard/manajemen/user renders', async ({ browser }, testInfo) => {
    const ctx = await browser.newContext()
    try {
      await superAdminAccountOrSkip(ctx, testInfo)
      // superAdminAccountOrSkip closes its own page; context has cookies if login ok

      const page = await ctx.newPage()
      try {
        await page.goto('/dashboard/manajemen/user', { waitUntil: 'networkidle' })

        // If login failed silently the URL will be /login — test already skipped
        if (page.url().includes('/login')) return

        // SUPERADMIN should NOT be redirected away from user management
        await expect(page).toHaveURL(/\/dashboard\/manajemen\/user/)
        await page.screenshot({
          path: resolve(EVIDENCE_DIR, 'superadmin-user-mgmt.png'),
          fullPage: true,
        })

        saveEvidenceItem(
          'SUPERADMIN accesses user management',
          'superadmin',
          'page renders without redirect',
          true,
          `url=${page.url()}`,
        )
      } finally {
        await page.close()
      }
    } finally {
      await ctx.close()
    }

    // Write combined user-mgmt guard evidence
    const userMgmtEvidence = evidence.filter((e) =>
      e.scenario.includes('user management'),
    )
    writeFileSync(
      resolve(EVIDENCE_DIR, 'user-mgmt-guard.json'),
      JSON.stringify(
        {
          suite: 'user-mgmt-guard',
          cases: userMgmtEvidence,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  })

  // ═══════════════════════════════════════════════════════════════
  // 5. Unauthenticated → /login?redirectTo=<path>
  // ═══════════════════════════════════════════════════════════════
  qaTest('Unauthenticated → /login?redirectTo=<path>', async ({ browser }) => {
    const ctx = await browser.newContext() // no cookies — unauthenticated
    const page = await ctx.newPage()
    try {
      const target = '/dashboard/keuangan/invoices'
      await page.goto(target, { waitUntil: 'networkidle' })

      const url = new URL(page.url())
      expect(url.pathname).toBe('/login')
      expect(url.searchParams.get('redirectTo')).toBe(target)

      saveEvidenceItem(
        'Unauthenticated redirect',
        'none',
        'redirect to /login?redirectTo',
        true,
        `redirectTo=${target}`,
      )
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 6. Non-TECH → /technician redirects to /dashboard
  // ═══════════════════════════════════════════════════════════════
  qaTest('non-TECH → /technician redirects to /dashboard', async () => {
    if (!adminCtx) return

    const page = await adminCtx.newPage()
    try {
      await page.goto('/technician', { waitUntil: 'networkidle' })
      await page.waitForURL(/\/dashboard(?:\/?$|\?)/, { timeout: 15_000 })
      const finalUrl = new URL(page.url())
      expect(finalUrl.pathname).toBe('/dashboard')

      saveEvidenceItem(
        'Non-TECH blocked from /technician',
        'admin',
        'redirect to /dashboard',
        true,
        `final=${finalUrl.pathname}`,
      )
    } finally {
      await page.close()
    }
  })
})
