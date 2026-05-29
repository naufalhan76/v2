/**
 * GPS audit — status transition payload validation.
 *
 * Chromium-mobile only: geolocation mock requires the Permissions API that
 * Playwright exposes via context.setGeolocation, which is most reliable on
 * Chromium. The test skips on other projects.
 *
 * The test also skips gracefully when no ASSIGNED job is available in the
 * seeded test environment — a missing order is not a test failure.
 */

import { test, expect, mockGeolocation } from './fixtures'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test.describe('GPS audit on status transitions', () => {
  test(
    'EN_ROUTE transition sends gps coords and idempotency_key',
    async ({ technicianPage: page, context }, testInfo) => {
      // Restrict to chromium-mobile project only
      test.skip(
        testInfo.project.name !== 'chromium-mobile',
        'chromium-mobile only'
      )

      // Assert Jakarta geolocation is active (matches playwright.config default)
      const coords = await mockGeolocation(context, {
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 12,
      })
      expect(coords.latitude).toBeCloseTo(-6.2088, 3)
      expect(coords.longitude).toBeCloseTo(106.8456, 3)

      // Navigate to job list and find any job link
      await page.goto('/technician')
      await page.waitForLoadState('networkidle')

      const jobLink = page.locator('a[href*="/technician/job/"]').first()
      const hasJob = await jobLink.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!hasJob) {
        test.skip(true, 'No jobs visible in the technician job list')
        return
      }

      const href = await jobLink.getAttribute('href')
      const orderId = href?.split('/technician/job/')[1]?.split('/')[0]
      if (!orderId) {
        test.skip(true, 'Could not extract order ID from job link href')
        return
      }

      await page.goto(`/technician/job/${orderId}`)
      await page.waitForLoadState('networkidle')

      // Only proceed if the job is in ASSIGNED state (shows "Berangkat" button)
      const berangkatBtn = page.getByRole('button', { name: /berangkat/i })
      const isAssigned = await berangkatBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
      if (!isAssigned) {
        test.skip(
          true,
          'Job is not in ASSIGNED state — EN_ROUTE transition unavailable'
        )
        return
      }

      // Intercept the transition POST before clicking
      let capturedPayload: Record<string, unknown> | null = null
      await page.route(
        `**/api/technician/jobs/${orderId}/transition`,
        async (route) => {
          capturedPayload = route.request().postDataJSON() as Record<
            string,
            unknown
          >
          await route.continue()
        }
      )

      await berangkatBtn.click()

      // Wait for the API response (success or server-side error — both are fine
      // for payload validation; we only care the request was sent)
      await page
        .waitForResponse(
          (resp) =>
            resp.url().includes(`/api/technician/jobs/${orderId}/transition`),
          { timeout: 15_000 }
        )
        .catch(() => {
          // Response may have already been captured; continue to assertions
        })

      // --- Payload assertions ---
      expect(capturedPayload, 'transition POST was not intercepted').not.toBeNull()
      const payload = capturedPayload!

      expect(payload.to_status).toBe('EN_ROUTE')

      // idempotency_key must be a UUID v4
      expect(typeof payload.idempotency_key).toBe('string')
      expect(
        UUID_V4_RE.test(payload.idempotency_key as string),
        `idempotency_key "${payload.idempotency_key}" is not a valid UUID v4`
      ).toBe(true)

      // gps object must be present with valid coordinate ranges
      const gps = payload.gps as Record<string, unknown>
      expect(gps, 'gps field missing from payload').toBeDefined()
      expect(typeof gps.lat).toBe('number')
      expect(typeof gps.lng).toBe('number')
      expect(gps.lat as number).toBeGreaterThanOrEqual(-90)
      expect(gps.lat as number).toBeLessThanOrEqual(90)
      expect(gps.lng as number).toBeGreaterThanOrEqual(-180)
      expect(gps.lng as number).toBeLessThanOrEqual(180)

      // --- Save evidence ---
      const evidenceDir = resolve(process.cwd(), '.omo/evidence')
      mkdirSync(evidenceDir, { recursive: true })
      writeFileSync(
        resolve(evidenceDir, 'task-7-gps.json'),
        JSON.stringify({ orderId, payload }, null, 2),
        'utf-8'
      )
    }
  )
})
