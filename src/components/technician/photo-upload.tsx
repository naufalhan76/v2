'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import { compressImage } from '@/lib/utils/image-compression'

interface PhotoUploadProps {
  /** Label for the photo group */
  label: string
  /** Storage bucket name */
  bucket: string
  /** Path prefix in the bucket (e.g., "orders/ORDER-123/before") */
  pathPrefix: string
  /** Current photo URLs */
  value: string[]
  /** Called when photos change */
  onChange: (urls: string[]) => void
  /** Minimum required photos */
  min?: number
  /** Maximum allowed photos */
  max?: number
  /** Disable interaction */
  disabled?: boolean
}

export function PhotoUpload({
  label,
  bucket,
  pathPrefix,
  value,
  onChange,
  min = 1,
  max = 5,
  disabled = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canAddMore = value.length < max

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setError(null)
      setUploading(true)
      setUploadProgress(0)

      const supabase = createClient()
      const newUrls: string[] = []
      const totalFiles = Math.min(files.length, max - value.length)

      try {
        for (let i = 0; i < totalFiles; i++) {
          const file = files[i]

          // Validate file type
          if (!file.type.startsWith('image/')) {
            setError('Hanya file gambar yang diperbolehkan')
            continue
          }

          // Validate file size (max 10MB before compression)
          if (file.size > 10 * 1024 * 1024) {
            setError('Ukuran file maksimal 10MB')
            continue
          }

          // Compress
          const { blob } = await compressImage(file, { maxBytes: 1_000_000, maxDimension: 1600 })

          // Generate unique filename
          const timestamp = Date.now()
          const filename = `${pathPrefix}/${timestamp}-${i}.jpg`

          // Upload to Supabase Storage
          const { data, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filename, blob, {
              contentType: blob.type,
              upsert: false,
            })

          if (uploadError) {
            throw new Error(`Upload gagal: ${uploadError.message}`)
          }

          // Get public URL
          const {
            data: { publicUrl },
          } = supabase.storage.from(bucket).getPublicUrl(data.path)

          newUrls.push(publicUrl)
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100))
        }

        onChange([...value, ...newUrls])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload gagal')
      } finally {
        setUploading(false)
        setUploadProgress(0)
        // Reset input
        if (inputRef.current) {
          inputRef.current.value = ''
        }
      }
    },
    [bucket, max, onChange, pathPrefix, value]
  )

  const handleRemove = useCallback(
    (index: number) => {
      const updated = value.filter((_, i) => i !== index)
      onChange(updated)
    },
    [onChange, value]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {label}
          <span className="text-ink-mute ml-1">
            ({value.length}/{max})
          </span>
        </label>
        {min > 0 && value.length < min && (
          <span className="text-xs text-destructive">Min. {min} foto</span>
        )}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Existing photos */}
        {value.map((url, index) => (
          <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${label} ${index + 1}`}
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label={`Hapus foto ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {canAddMore && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-hairline bg-canvas-soft',
              'text-ink-mute hover:border-primary hover:text-primary transition-colors',
              'min-h-[80px]',
              uploading && 'pointer-events-none opacity-50'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin mb-1" />
                <span className="text-xs">{uploadProgress}%</span>
              </>
            ) : (
              <>
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-xs">Ambil Foto</span>
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

      {/* Hidden file input */}
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
