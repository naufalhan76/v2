'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'

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

/**
 * Compress an image file using canvas.
 * Target: JPEG quality 0.7, max dimension 1200px, ~500KB result.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate target dimensions (max 1200px on longest side)
      const MAX_DIM = 1200
      let { width, height } = img

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Compression failed'))
          }
        },
        'image/jpeg',
        0.7
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
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
          const compressed = await compressImage(file)

          // Generate unique filename
          const timestamp = Date.now()
          const filename = `${pathPrefix}/${timestamp}-${i}.jpg`

          // Upload to Supabase Storage
          const { data, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filename, compressed, {
              contentType: 'image/jpeg',
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
          <span className="text-muted-foreground ml-1">
            ({value.length}/{max})
          </span>
        </label>
        {min > 0 && value.length < min && (
          <span className="text-xs text-destructive">Min. {min} foto</span>
        )}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
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
              'flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed',
              'text-muted-foreground hover:border-primary hover:text-primary transition-colors',
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
