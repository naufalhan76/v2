'use client'

import { notFound } from 'next/navigation'
import { useEffect } from 'react'
import { compressImage } from '@/lib/utils/image-compression'
import type { CompressOptions, CompressResult } from '@/lib/utils/image-compression'

// Block in production.
if (process.env.NODE_ENV === 'production') {
  notFound()
}

declare global {
  interface Window {
    __compressImage: (blob: Blob, opts?: CompressOptions) => Promise<CompressResult>
    __compressionReady: boolean
  }
}

export default function CompressTestPage() {
  useEffect(() => {
    window.__compressImage = compressImage
    window.__compressionReady = true
  }, [])

  return (
    <main>
      <p>compression test harness</p>
    </main>
  )
}
