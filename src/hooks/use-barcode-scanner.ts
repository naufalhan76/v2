"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"

export interface UseBarcodeScannerOptions {
  onDetected: (value: string) => void
}

export interface UseBarcodeScannerReturn {
  isSupported: boolean
  isScanning: boolean
  startScanning: () => Promise<void>
  stopScanning: () => void
}

export function useBarcodeScanner({
  onDetected,
}: UseBarcodeScannerOptions): UseBarcodeScannerReturn {
  const [isSupported] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window)
  const [isScanning, setIsScanning] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const rafRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
    }
    detectorRef.current = null
    setIsScanning(false)
  }, [])

  const scanLoop = useCallback(() => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop)
      return
    }
    detector
      .detect(video)
      .then((barcodes) => {
        if (barcodes.length > 0) {
          onDetectedRef.current(barcodes[0].rawValue)
          stopStream()
          return
        }
        rafRef.current = requestAnimationFrame(scanLoop)
      })
      .catch(() => {
        rafRef.current = requestAnimationFrame(scanLoop)
      })
  }, [stopStream])

  const startScanning = useCallback(async () => {
    if (!isSupported || isScanning) return
    try {
      // Verify secure context first — getUserMedia only works on HTTPS or localhost
      if (!window.isSecureContext) {
        toast({ title: "Kamera hanya tersedia di koneksi aman (HTTPS)", variant: "destructive" })
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      })
      streamRef.current = stream
      const video = document.createElement("video")
      video.setAttribute("playsinline", "")
      video.srcObject = stream
      await video.play()
      videoRef.current = video
      // BarcodeDetector with empty formats array fails on some browsers.
      // Omit formats entirely to detect all supported types.
      try {
        detectorRef.current = new BarcodeDetector({ formats: [] })
      } catch {
        detectorRef.current = new BarcodeDetector()
      }
      setIsScanning(true)
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err: unknown) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        toast({ title: "Akses kamera ditolak", description: "Izinkan kamera di pengaturan browser lalu coba lagi", variant: "destructive" })
      } else if (error.name === 'NotFoundError') {
        toast({ title: "Kamera tidak ditemukan", description: "Perangkat tidak memiliki kamera belakang", variant: "destructive" })
      } else if (error.name === 'NotReadableError') {
        toast({ title: "Kamera sedang digunakan", description: "Tutup aplikasi lain yang menggunakan kamera", variant: "destructive" })
      } else {
        toast({ title: "Kamera tidak tersedia", description: error.message || "Coba lagi", variant: "destructive" })
      }
      stopStream()
    }
  }, [isSupported, isScanning, scanLoop, stopStream])

  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return { isSupported, isScanning, startScanning, stopScanning: stopStream }
}
