'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, ImageOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ReportPhotoGalleryProps {
  title: string
  photos: string[]
  className?: string
}

export function ReportPhotoGallery({ title, photos, className }: ReportPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const isOpen = activeIndex !== null
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-muted-foreground" />
        {title}
        <span className="text-xs font-normal text-muted-foreground">
          ({photos.length})
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          <ImageOff className="mr-2 h-4 w-4" />
          Tidak ada foto
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className="relative aspect-square overflow-hidden rounded-md border bg-muted transition hover:brightness-95"
              aria-label={`${title} ${idx + 1}`}
            >
              <Image
                src={url}
                alt={`${title} ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 33vw, 200px"
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {title} {activeIndex !== null && `— ${activeIndex + 1}/${photos.length}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Menampilkan detail foto dokumentasi.
            </DialogDescription>
          </DialogHeader>
          {activePhoto && (
            <div className="relative h-[70vh] w-full overflow-hidden rounded-md bg-black">
              <Image
                src={activePhoto}
                alt={title}
                fill
                sizes="100vw"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
