import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.skip(({ browserName }) => browserName !== 'chromium', 'chromium-mobile only')

declare global {
  interface Window {
    __signatureBlob: Blob | null | undefined
  }
}

test('SignaturePad calls onBlobChange with PNG Blob after drawing and null after clear', async ({ page }) => {
  await page.goto('/test/signature')

  const canvas = page.locator('canvas[aria-label="Area tanda tangan customer"]')
  await canvas.waitFor({ state: 'visible' })

  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not found')

  // Draw a horizontal stroke across the middle of the canvas
  await page.mouse.move(box.x + 40, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 15 })
  await page.mouse.up()

  // Wait for onBlobChange to fire with a Blob
  await page.waitForFunction(() => window.__signatureBlob instanceof Blob)

  // Assert blob properties
  const blobInfo = await page.evaluate(() => {
    const blob = window.__signatureBlob
    if (!(blob instanceof Blob)) return null
    return { size: blob.size, type: blob.type }
  })

  expect(blobInfo).not.toBeNull()
  expect(blobInfo!.size).toBeGreaterThan(0)
  expect(blobInfo!.type).toBe('image/png')

  // Save evidence screenshot after drawing
  const evidenceDir = path.resolve('.omo/evidence')
  fs.mkdirSync(evidenceDir, { recursive: true })
  await page.screenshot({ path: path.join(evidenceDir, 'task-3-signature.png') })

  // Click the clear button
  const clearButton = page.getByRole('button', { name: /hapus/i })
  await clearButton.click()

  // Wait for onBlobChange(null) to fire
  await page.waitForFunction(() => window.__signatureBlob === null)

  const isNull = await page.evaluate(() => window.__signatureBlob === null)
  expect(isNull).toBe(true)
})
