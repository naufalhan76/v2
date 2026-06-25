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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      const video = document.createElement("video")
      video.setAttribute("playsinline", "")
      video.srcObject = stream
      await video.play()
      videoRef.current = video
      detectorRef.current = new BarcodeDetector({ formats: [] })
      setIsScanning(true)
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch {
      toast({ title: "Kamera tidak tersedia", variant: "destructive" })
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
