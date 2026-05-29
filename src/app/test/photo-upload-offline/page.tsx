'use client'

import { useState, useCallback, useEffect } from 'react'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import { deletePhotosForOrder, getDb } from '@/lib/offline/db'

declare global {
  interface Window {
    __photoState: { urls: string[]; photoIds: string[] }
    __resetPhotoState: () => Promise<void>
    __getIdbPhotoCount: () => Promise<number>
  }
}

// Initialise synchronously so Playwright waitForFunction resolves right after load.
if (typeof window !== 'undefined') {
  window.__photoState = { urls: [], photoIds: [] }
}

export default function PhotoUploadOfflineTestPage() {
  const [urls, setUrls] = useState<string[]>([])
  const [photoIds, setPhotoIds] = useState<string[]>([])

  const handleChange = useCallback((nextUrls: string[], nextIds: string[]) => {
    setUrls(nextUrls)
    setPhotoIds(nextIds)
    window.__photoState = { urls: nextUrls, photoIds: nextIds }
  }, [])

  const handleReset = useCallback(async () => {
    for (const u of urls) {
      try { URL.revokeObjectURL(u) } catch { /* ignore */ }
    }
    setUrls([])
    setPhotoIds([])
    window.__photoState = { urls: [], photoIds: [] }
    await deletePhotosForOrder('TEST-1')
  }, [urls])

  // Expose helpers once mounted
  useEffect(() => {
    window.__resetPhotoState = async () => {
      for (const u of window.__photoState.urls) {
        try { URL.revokeObjectURL(u) } catch { /* ignore */ }
      }
      window.__photoState = { urls: [], photoIds: [] }
      await deletePhotosForOrder('TEST-1')
    }

    window.__getIdbPhotoCount = async () => {
      const db = await getDb()
      return db.count('pendingPhotos')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep window.__photoState in sync with React state
  useEffect(() => {
    window.__photoState = { urls, photoIds }
  }, [urls, photoIds])

  return (
    <main style={{ padding: '16px', maxWidth: '480px' }}>
      <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
        photo-upload-offline test harness
      </p>

      <PhotoUploadOffline
        orderId="TEST-1"
        acUnitIdx={0}
        kind="before"
        min={1}
        max={3}
        value={urls}
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={handleReset}
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        aria-label="Reset state and IDB"
      >
        Reset
      </button>

      <pre
        style={{ marginTop: '12px', fontSize: '11px', color: '#888', wordBreak: 'break-all' }}
        aria-label="debug state"
      >
        {JSON.stringify({ urls, photoIds }, null, 2)}
      </pre>
    </main>
  )
}
