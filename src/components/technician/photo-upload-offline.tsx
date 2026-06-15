'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/utils/image-compression'
import { enqueuePhoto } from '@/lib/offline/sync-manager'
import { deletePhoto } from '@/lib/offline/db'
import type { PhotoKind } from '@/lib/offline/db'
import { useToast } from '@/hooks/use-toast'
import { PhotoThumbnail } from './photo-thumbnail'

export type PhotoUploadOfflineProps = {
  orderId: string
  acUnitIdx: number
  kind: 'before' | 'after' | 'signature'
  value: string[]
  onChange: (urls: string[], photoIds: string[]) => void
  min?: number
  max?: number
  disabled?: boolean
}

type PhotoEntry = { url: string; photoId: string; synced: boolean }

export function PhotoUploadOffline({ orderId, acUnitIdx, kind, value, onChange, min = 1, max = 5, disabled = false }: PhotoUploadOfflineProps): React.JSX.Element {
  const { toast } = useToast()
  const [entries, setEntries] = useState<PhotoEntry[]>(() => value.map((url) => ({ url, photoId: '', synced: false })))
  const [enqueueing, setEnqueueing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ownedUrlsRef = useRef<Set<string>>(new Set())

  const syncToParent = useCallback((next: PhotoEntry[]) => {
    onChange(next.map((e) => e.url), next.map((e) => e.photoId))
  }, [onChange])

  useEffect(() => { return () => { ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)) } }, [])

  const canAddMore = entries.length < max

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError(null); setEnqueueing(true)
    const slots = max - entries.length
    const totalFiles = Math.min(files.length, slots)
    try {
      const newEntries: PhotoEntry[] = []
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) { setError('Hanya file gambar yang diperbolehkan'); continue }
        if (file.size > 10 * 1024 * 1024) { setError('Ukuran file maksimal 10MB'); continue }
        const compressed = await compressImage(file, { maxBytes: 1_000_000, maxDimension: 1600 })
        let record
        try {
          record = await enqueuePhoto({ orderId, acUnitIdx, kind: kind as PhotoKind, blob: compressed.blob, bytes: compressed.bytes, width: compressed.width, height: compressed.height, mimeType: compressed.mimeType })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.startsWith('STORAGE_QUOTA_CRITICAL')) { toast({ title: 'Penyimpanan hampir penuh', description: 'Sinkronkan data terlebih dahulu sebelum menambah foto.', variant: 'destructive' }); break }
          throw err
        }
        const previewUrl = URL.createObjectURL(compressed.blob)
        ownedUrlsRef.current.add(previewUrl)
        newEntries.push({ url: previewUrl, photoId: record.id, synced: record.uploadedPath !== null })
      }
      if (newEntries.length > 0) { setEntries((prev) => { const next = [...prev, ...newEntries]; syncToParent(next); return next }) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menambah foto') }
    finally { setEnqueueing(false); if (inputRef.current) inputRef.current.value = '' }
  }, [acUnitIdx, entries.length, kind, max, orderId, syncToParent, toast])

  const handleRemove = useCallback(async (index: number) => {
    const entry = entries[index]; if (!entry) return
    if (entry.photoId) { try { await deletePhoto(entry.photoId) } catch { /* best-effort */ } }
    if (ownedUrlsRef.current.has(entry.url)) { URL.revokeObjectURL(entry.url); ownedUrlsRef.current.delete(entry.url) }
    setEntries((prev) => { const next = prev.filter((_, i) => i !== index); syncToParent(next); return next })
  }, [entries, syncToParent])

  const kindLabel: Record<PhotoUploadOfflineProps['kind'], string> = { before: 'Foto Sebelum', after: 'Foto Sesudah', signature: 'Tanda Tangan' }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{kindLabel[kind]}<span className="text-muted-foreground ml-1">({entries.length}/{max})</span></label>
        {min > 0 && entries.length < min && <span className="text-xs text-destructive">Min. {min} foto</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {entries.map((entry, index) => (
          <PhotoThumbnail key={entry.url} url={entry.url} photoId={entry.photoId} synced={entry.synced} index={index} kindLabel={kindLabel[kind]} disabled={disabled} onRemove={handleRemove} />
        ))}
        {canAddMore && !disabled && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={enqueueing}
            className={cn('flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border dark:border-border bg-surface-muted dark:bg-surface', 'text-muted-foreground hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-brand-200 transition-colors', 'min-h-[80px] active:scale-95', enqueueing && 'pointer-events-none opacity-50')}
            aria-label="Tambah foto">
            {enqueueing ? (<><ImageIcon className="h-6 w-6 mb-1 animate-pulse" /><span className="text-xs">Memproses...</span></>) : (<><Upload className="h-6 w-6 mb-1" /><span className="text-xs">Tambah</span></>)}
          </button>
        )}
      </div>
      {error && (<div className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{error}</span></div>)}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileSelect} className="hidden" aria-hidden="true" />
    </div>
  )
}
