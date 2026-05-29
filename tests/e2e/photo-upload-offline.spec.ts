import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.skip(({ browserName }) => browserName !== 'chromium', 'chromium-mobile only')

declare global {
  interface Window {
    __photoState: { urls: string[]; photoIds: string[] }
    __resetPhotoState: () => Promise<void>
    __getIdbPhotoCount: () => Promise<number>
  }
}

/**
 * Synthesize a ~2MB JPEG buffer in-process (Node side) using a canvas-like
 * approach: we build a minimal valid JPEG by repeating a pattern.
 * Since we can't use canvas in Node, we create a large random buffer and
 * wrap it as a JPEG-like file that the browser will accept via setInputFiles.
 *
 * Strategy: create a real JPEG via a data URL in the browser context, then
 * pass it as a buffer to setInputFiles.
 */
async function makeSyntheticJpegBuffer(page: import('@playwright/test').Page): Promise<Buffer> {
  // Generate a ~2MB JPEG on the browser side using canvas, return as base64.
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 1500
    const ctx = canvas.getContext('2d')!

    // Fill with random-ish pixel data so JPEG doesn't compress too aggressively.
    const imageData = ctx.createImageData(2000, 1500)
    const data = imageData.data
    for (let i = 0; i < data.length; i++) {
      data[i] = (i * 37 + 13) % 256
    }
    ctx.putImageData(imageData, 0, 0)

    return new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) { reject(new Error('toBlob returned null')); return }
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = () => reject(new Error('FileReader error'))
          reader.readAsDataURL(b)
        },
        'image/jpeg',
        0.95
      )
    })
  })

  return Buffer.from(base64, 'base64')
}

test('PhotoUploadOffline enqueues compressed photo to IDB and exposes preview URL', async ({ page }) => {
  await page.goto('/test/photo-upload-offline')

  // Wait for the harness to be ready (window.__photoState exposed)
  await page.waitForFunction(() => typeof window.__photoState !== 'undefined')

  // Synthesize a ~2MB JPEG buffer using the browser canvas
  const jpegBuffer = await makeSyntheticJpegBuffer(page)

  // Locate the hidden file input
  const fileInput = page.locator('input[type="file"]')

  // Upload the synthesized JPEG
  await fileInput.setInputFiles({
    name: 'test-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: jpegBuffer,
  })

  // Wait for the photo to be enqueued and preview URL to appear
  await page.waitForFunction(
    () =>
      window.__photoState.urls.length === 1 &&
      typeof window.__photoState.photoIds[0] === 'string' &&
      window.__photoState.photoIds[0].length > 0,
    { timeout: 15_000 }
  )

  // Verify state shape
  const state = await page.evaluate(() => window.__photoState)
  expect(state.urls).toHaveLength(1)
  expect(state.urls[0]).toMatch(/^blob:/)
  expect(state.photoIds[0]).toBeTruthy()
  expect(state.photoIds[0].length).toBeGreaterThan(0)

  // Take evidence screenshot
  const evidenceDir = path.resolve('.omo/evidence')
  fs.mkdirSync(evidenceDir, { recursive: true })
  await page.screenshot({ path: path.join(evidenceDir, 'task-8b-offline-photo.png') })

  // Assert IDB count via the window-exposed helper
  const idbCount = await page.evaluate(() => window.__getIdbPhotoCount())
  expect(idbCount).toBeGreaterThanOrEqual(1)

  // Verify the thumbnail is visible in the DOM
  const thumbnail = page.locator('img[alt="Foto Sebelum 1"]')
  await expect(thumbnail).toBeVisible()

  // Verify the "Belum tersinkron" badge is shown (not yet uploaded)
  const badge = page.locator('text=Belum tersinkron')
  await expect(badge).toBeVisible()
})

test('PhotoUploadOffline remove button deletes from IDB and revokes URL', async ({ page }) => {
  await page.goto('/test/photo-upload-offline')
  await page.waitForFunction(() => typeof window.__photoState !== 'undefined')

  const jpegBuffer = await makeSyntheticJpegBuffer(page)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'test-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: jpegBuffer,
  })

  // Wait for photo to appear
  await page.waitForFunction(
    () => window.__photoState.urls.length === 1,
    { timeout: 15_000 }
  )

  // Click the remove button
  const removeBtn = page.locator('button[aria-label="Hapus foto 1"]')
  await expect(removeBtn).toBeVisible()
  await removeBtn.click()

  // State should be empty
  await page.waitForFunction(() => window.__photoState.urls.length === 0)

  const state = await page.evaluate(() => window.__photoState)
  expect(state.urls).toHaveLength(0)
  expect(state.photoIds).toHaveLength(0)

  // IDB should be empty for this order
  const idbCount = await page.evaluate(() => window.__getIdbPhotoCount())
  expect(idbCount).toBe(0)
})
