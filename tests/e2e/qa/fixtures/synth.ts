/**
 * Photo + signature synthesis helpers — keeps every spec deterministic and
 * dep-free. Generated images are uploaded directly to Supabase Storage when
 * a spec needs to short-circuit the offline pipeline.
 */

import type { Page } from '@playwright/test'

/**
 * Synthesise a JPEG of approximately `targetKb` kilobytes by drawing
 * pseudo-random pixels onto a canvas.
 */
export async function synthJpegBlob(
  page: Page,
  options: { width?: number; height?: number; quality?: number } = {}
): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' }> {
  const w = options.width ?? 600
  const h = options.height ?? 400
  const q = options.quality ?? 0.7
  const dataUrl = await page.evaluate(
    async ({ w, h, q }) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(w, h)
      const seed = Math.floor(Math.random() * 1000)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (i + seed) % 256
        img.data[i + 1] = (i * 3 + seed) % 256
        img.data[i + 2] = (i * 7 + seed) % 256
        img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      return await new Promise<string>((resolve) => {
        canvas.toBlob(
          (b) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(b!)
          },
          'image/jpeg',
          q
        )
      })
    },
    { w, h, q }
  )
  const base64 = dataUrl.split(',')[1] ?? ''
  return { buffer: Buffer.from(base64, 'base64'), mimeType: 'image/jpeg' }
}

/**
 * Synthesise a tiny PNG signature.
 */
export async function synthSignaturePng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(20, 80)
    ctx.bezierCurveTo(80, 20, 200, 100, 300, 60)
    ctx.stroke()
    return await new Promise<string>((resolve) => {
      canvas.toBlob((b) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(b!)
      }, 'image/png')
    })
  })
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')
}
