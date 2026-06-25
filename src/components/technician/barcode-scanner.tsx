"use client"

import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface BarcodeScannerProps {
  onDetected: (value: string) => void
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const { isSupported, isScanning, startScanning } = useBarcodeScanner({ onDetected })

  if (!isSupported) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isScanning}
      onClick={startScanning}
    >
      {isScanning ? (
        <>
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          Memindai...
        </>
      ) : (
        "Scan"
      )}
    </Button>
  )
}
