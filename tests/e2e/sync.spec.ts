/**
 * E2E tests for drainQueue via the /%5F%5Ftest/sync harness page.
 *
 * Uses the technicianPage fixture (skips if no creds configured).
 * For the empty-queue test we also run without auth to verify the AUTH
 * error path.
 */

import { test as authTest, expect } from './fixtures/auth'
import { test as base } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const HARNESS_PATH = '/test/sync'

// ---------------------------------------------------------------------------
// Unauthenticated path — no creds needed, just a plain browser page
// ---------------------------------------------------------------------------

base.describe('drainQueue — no session', () => {
  base.use({ storageState: { cookies: [], origins: [] } })

  base('drainQueue with empty IDB returns AUTH error when no session', async ({ page }) => {
    await page.goto(HARNESS_PATH)
    await page.waitForLoadState('networkidle')

    // Wait for the harness to mount and expose __drainQueue
    await page.waitForFunction(() => typeof (window as any).__drainQueue === 'function', {
      timeout: 15_000,
    })

    const result = await page.evaluate(async () => {
      return await (window as any).__drainQueue()
    })

    // No items queued
    expect(result.reportsAttempted).toBe(0)
    expect(result.transitionsAttempted).toBe(0)
    expect(result.reportsSynced).toBe(0)
    expect(result.transitionsSynced).toBe(0)

    // Without a session the AUTH error must be present
    const authError = (result.errors as Array<{ kind: string; key: string; message: string }>)
      .find((e) => e.key === 'AUTH')
    expect(authError).toBeDefined()
    expect(authError?.message).toMatch(/AUTH_REQUIRED/)

    // Persist evidence
    const evidenceDir = resolve(process.cwd(), '.omo/evidence')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      resolve(evidenceDir, 'task-9-sync.txt'),
      JSON.stringify({ scenario: 'no-session', result }, null, 2)
    )
  })
})

// ---------------------------------------------------------------------------
// Authenticated path — skips if TEST_TECHNICIAN_* not set
// ---------------------------------------------------------------------------

authTest.describe('drainQueue — authenticated, empty IDB', () => {
  authTest(
    'returns zero counts and no errors when queue is empty',
    async ({ technicianPage: page }) => {
      await page.goto(HARNESS_PATH)

      await page.waitForFunction(() => typeof (window as any).__drainQueue === 'function', {
        timeout: 15_000,
      })

      const result = await page.evaluate(async () => {
        return await (window as any).__drainQueue()
      })

      expect(result.reportsAttempted).toBe(0)
      expect(result.transitionsAttempted).toBe(0)
      expect(result.reportsSynced).toBe(0)
      expect(result.transitionsSynced).toBe(0)
      expect(result.errors).toHaveLength(0)

      // Overwrite evidence with authenticated result
      const evidenceDir = resolve(process.cwd(), '.omo/evidence')
      mkdirSync(evidenceDir, { recursive: true })
      writeFileSync(
        resolve(evidenceDir, 'task-9-sync.txt'),
        JSON.stringify({ scenario: 'authenticated-empty', result }, null, 2)
      )
    }
  )
})
