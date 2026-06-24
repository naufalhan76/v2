'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScanLine, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

// ponytail: only code_128 + ean_13 — covers AC serial numbers and service stickers. Add more formats if needed.
const BARCODE_FORMATS = ['code_128', 'ean_13'] as const

function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

interface BarcodeScannerProps {
  onScan: (value: string) => void
  disabled?: boolean
}

export function BarcodeScanner({ onScan, disabled }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startScanning = useCallback(async () => {
    setError(null)
    cleanup()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // ponytail: requestAnimationFrame polling. For production, consider OffscreenCanvas + Worker.
      const detector = new (window as any).BarcodeDetector({ formats: BARCODE_FORMATS })

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animRef.current = requestAnimationFrame(tick)
          return
        }
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            onScan(barcodes[0].rawValue)
            handleClose()
            return
          }
        } catch {
          // Detection can fail on some frames — just retry
        }
        animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Izin kamera ditolak'
        : 'Gagal mengakses kamera'
      setError(msg)
    }
  }, [onScan, cleanup])

  const handleClose = useCallback(() => {
    cleanup()
    setOpen(false)
    setError(null)
  }, [cleanup])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const handleOpen = useCallback(() => {
    if (!isBarcodeDetectorSupported()) {
      toast({
        title: 'Browser tidak didukung',
        description: 'Barcode scanner memerlukan Chrome atau Edge versi terbaru.',
        variant: 'default',
      })
      return
    }
    setOpen(true)
    // Start scanning after dialog opens so video element is in DOM
    setTimeout(() => startScanning(), 100)
  }, [startScanning])

  if (!isBarcodeDetectorSupported()) return null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        aria-label="Scan barcode"
      >
        <ScanLine className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
          <div
            className="relative w-full max-w-sm rounded-lg bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Scan Barcode</h3>
              <button onClick={handleClose} className="rounded-sm p-1 hover:bg-muted" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <div className="flex h-48 items-center justify-center rounded-md bg-muted text-sm text-destructive">
                {error}
              </div>
            ) : (
              <video
                ref={videoRef}
                className="w-full rounded-md"
                autoPlay
                playsInline
                muted
              />
            )}

            <p className="mt-2 text-center text-xs text-muted-foreground">
              Arahkan kamera ke barcode AC
            </p>
          </div>
        </div>
      )}
    </>
  )
}
