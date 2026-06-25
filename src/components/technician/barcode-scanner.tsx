"use client"

import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"
import { Button } from "@/components/ui/button"
import { Loader2, X, ScanLine } from "lucide-react"
import { useEffect, useRef } from "react"

interface BarcodeScannerProps {
  onDetected: (value: string) => void
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const { isSupported, isScanning, startScanning, stopScanning, videoRef } = useBarcodeScanner({ onDetected })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (video && container && isScanning) {
      container.appendChild(video)
      video.style.width = "100%"
      video.style.height = "100%"
      video.style.objectFit = "cover"
      return () => {
        if (container.contains(video)) {
          container.removeChild(video)
        }
      }
    }
  }, [isScanning, videoRef])

  if (!isSupported) return null

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={isScanning} onClick={startScanning}>
        {isScanning ? (
          <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Memindai...</>
        ) : (
          "Scan"
        )}
      </Button>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black">
          <div ref={containerRef} className="absolute inset-0" />
          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
              <ScanLine className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-primary animate-pulse" size={256} strokeWidth={1} />
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
            </div>
          </div>
          <p className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
            Arahkan kamera ke barcode
          </p>
          <button
            type="button"
            onClick={stopScanning}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-white/90 text-primary rounded-full px-8 py-3 font-semibold shadow-lg active:scale-95 transition-transform"
          >
            <X className="inline mr-2 h-5 w-5" />
            Batal
          </button>
        </div>
      )}
    </>
  )
}
