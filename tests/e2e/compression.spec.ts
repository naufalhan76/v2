import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.skip(({ browserName }) => browserName !== 'chromium', 'chromium-mobile only')

test('compressImage reduces a ~5MB JPEG below 1MB', async ({ page }) => {
  await page.goto('/__test/compress')

  await page.waitForFunction(() => window.__compressionReady === true)

  const result = await page.evaluate(async () => {
    // Synthesize a ~5MB JPEG: 3000x3000 canvas with random pixels.
    const canvas = document.createElement('canvas')
    canvas.width = 3000
    canvas.height = 3000
    const ctx = canvas.getContext('2d')!

    // Fill with random pixel data to prevent trivial compression.
    const imageData = ctx.createImageData(3000, 3000)
    const data = imageData.data
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 256)
    }
    ctx.putImageData(imageData, 0, 0)

    const inputBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        0.95,
      )
    })

    const compressResult = await window.__compressImage(inputBlob, { maxBytes: 1_000_000 })

    return {
      inputBytes: inputBlob.size,
      outputBytes: compressResult.bytes,
      width: compressResult.width,
      height: compressResult.height,
      mimeType: compressResult.mimeType,
    }
  })

  expect(result.outputBytes).toBeLessThan(1_000_000)

  // Write evidence file.
  const evidenceDir = path.resolve('.omo/evidence')
  fs.mkdirSync(evidenceDir, { recursive: true })
  const line = `${result.inputBytes}B -> ${result.outputBytes}B ok ${result.width}x${result.height} ${result.mimeType}`
  fs.writeFileSync(path.join(evidenceDir, 'task-2-compression.txt'), line + '\n', 'utf8')
})
