'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/utils/image-compression'
import { enqueuePhoto } from '@/lib/offline/sync-manager'
import { deletePhoto } from '@/lib/offline/db'
import type { PhotoKind } from '@/lib/offline/db'
import { useToast } from '@/hooks/use-toast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhotoUploadOfflineProps = {
  orderId: string
  /** AC unit index in the parent form, or -1 for job-level photos */
  acUnitIdx: number
  /** 'before' | 'after' | 'signature' */
  kind: 'before' | 'after' | 'signature'
  /** Local preview URLs (object URLs from queued blobs) */
  value: string[]
  onChange: (urls: string[], photoIds: string[]) => void
  min?: number
  max?: number
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Per-thumbnail state (tracks photoId alongside the object URL)
// ---------------------------------------------------------------------------

type PhotoEntry = {
  url: string
  photoId: string
  /** true once uploadedPath is set on the IDB record */
  synced: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhotoUploadOffline({
  orderId,
  acUnitIdx,
  kind,
  value,
  onChange,
  min = 1,
  max = 5,
  disabled = false,
}: PhotoUploadOfflineProps): React.JSX.Element {
  const { toast } = useToast()
  const [entries, setEntries] = useState<PhotoEntry[]>(() =>
    value.map((url) => ({ url, photoId: '', synced: false }))
  )
  const [enqueueing, setEnqueueing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track object URLs created here so we can revoke them on unmount.
  const ownedUrlsRef = useRef<Set<string>>(new Set())

  // Sync entries → parent whenever entries change.
  const syncToParent = useCallback(
    (next: PhotoEntry[]) => {
      onChange(
        next.map((e) => e.url),
        next.map((e) => e.photoId)
      )
    },
    [onChange]
  )

  // Revoke all owned object URLs on unmount.
  useEffect(() => {
    return () => {
      ownedUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [])

  const canAddMore = entries.length < max

  // -------------------------------------------------------------------------
  // File pick handler
  // -------------------------------------------------------------------------

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setError(null)
      setEnqueueing(true)

      const slots = max - entries.length
      const totalFiles = Math.min(files.length, slots)

      try {
        const newEntries: PhotoEntry[] = []

        for (let i = 0; i < totalFiles; i++) {
          const file = files[i]

          if (!file.type.startsWith('image/')) {
            setError('Hanya file gambar yang diperbolehkan')
            continue
          }

          if (file.size > 10 * 1024 * 1024) {
            setError('Ukuran file maksimal 10MB')
            continue
          }

          // Compress
          const compressed = await compressImage(file, {
            maxBytes: 1_000_000,
            maxDimension: 1600,
          })

          // Enqueue to IDB — may throw STORAGE_QUOTA_CRITICAL
          let record
          try {
            record = await enqueuePhoto({
              orderId,
              acUnitIdx,
              kind: kind as PhotoKind,
              blob: compressed.blob,
              bytes: compressed.bytes,
              width: compressed.width,
              height: compressed.height,
              mimeType: compressed.mimeType,
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.startsWith('STORAGE_QUOTA_CRITICAL')) {
              toast({
                title: 'Penyimpanan hampir penuh',
                description: 'Sinkronkan data terlebih dahulu sebelum menambah foto.',
                variant: 'destructive',
              })
              break
            }
            throw err
          }

          // Create local preview URL
          const previewUrl = URL.createObjectURL(compressed.blob)
          ownedUrlsRef.current.add(previewUrl)

          newEntries.push({
            url: previewUrl,
            photoId: record.id,
            synced: record.uploadedPath !== null,
          })
        }

        if (newEntries.length > 0) {
          setEntries((prev) => {
            const next = [...prev, ...newEntries]
            syncToParent(next)
            return next
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal menambah foto')
      } finally {
        setEnqueueing(false)
        if (inputRef.current) {
          inputRef.current.value = ''
        }
      }
    },
    [acUnitIdx, entries.length, kind, max, orderId, syncToParent]
  )

  // -------------------------------------------------------------------------
  // Remove handler
  // -------------------------------------------------------------------------

  const handleRemove = useCallback(
    async (index: number) => {
      const entry = entries[index]
      if (!entry) return

      // Delete from IDB if we have a photoId
      if (entry.photoId) {
        try {
          await deletePhoto(entry.photoId)
        } catch {
          // Best-effort; proceed with UI removal regardless
        }
      }

      // Revoke object URL if we own it
      if (ownedUrlsRef.current.has(entry.url)) {
        URL.revokeObjectURL(entry.url)
        ownedUrlsRef.current.delete(entry.url)
      }

      setEntries((prev) => {
        const next = prev.filter((_, i) => i !== index)
        syncToParent(next)
        return next
      })
    },
    [entries, syncToParent]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const kindLabel: Record<PhotoUploadOfflineProps['kind'], string> = {
    before: 'Foto Sebelum',
    after: 'Foto Sesudah',
    signature: 'Tanda Tangan',
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {kindLabel[kind]}
          <span className="text-muted-foreground ml-1">
            ({entries.length}/{max})
          </span>
        </label>
        {min > 0 && entries.length < min && (
          <span className="text-xs text-destructive">Min. {min} foto</span>
        )}
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 gap-2">
        {entries.map((entry, index) => (
          <div
            key={entry.url}
            className="relative aspect-square rounded-lg overflow-hidden border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.url}
              alt={`${kindLabel[kind]} ${index + 1}`}
              className="h-full w-full object-cover"
            />

            {/* Pending badge */}
            {!entry.synced && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center"
                aria-label="Belum tersinkron"
              >
                <span className="text-[10px] text-yellow-300 leading-none">
                  Belum tersinkron
                </span>
              </div>
            )}

            {/* Remove button */}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 active:bg-black/90"
                aria-label={`Hapus foto ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {canAddMore && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enqueueing}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed',
              'text-muted-foreground hover:border-primary hover:text-primary transition-colors',
              'min-h-[80px] active:scale-95',
              enqueueing && 'pointer-events-none opacity-50'
            )}
            aria-label="Tambah foto"
          >
            {enqueueing ? (
              <>
                <ImageIcon className="h-6 w-6 mb-1 animate-pulse" />
                <span className="text-xs">Memproses...</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 mb-1" />
                <span className="text-xs">Tambah</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden file input — no capture attr so desktop also works */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
