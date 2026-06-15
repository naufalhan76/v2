'use client'

import { X } from 'lucide-react'
import { deletePhoto } from '@/lib/offline/db'

interface PhotoThumbnailProps {
  url: string
  photoId: string
  synced: boolean
  index: number
  kindLabel: string
  disabled: boolean
  onRemove: (index: number) => void
}

export function PhotoThumbnail({
  url,
  photoId,
  synced,
  index,
  kindLabel,
  disabled,
  onRemove,
}: PhotoThumbnailProps) {
  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${kindLabel} ${index + 1}`}
        className="h-full w-full object-cover"
      />

      {/* Pending badge */}
      {!synced && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center"
          aria-label="Belum tersinkron"
        >
          <span className="text-[10px] text-status-pending leading-none">
            Belum tersinkron
          </span>
        </div>
      )}

      {/* Remove button */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 active:bg-black/90"
          aria-label={`Hapus foto ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
