interface BarcodeDetectorOptions {
  formats?: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
  cornerPoints: { x: number; y: number }[]
  boundingBox: DOMRectReadOnly
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  static getSupportedFormats(): Promise<string[]>
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}

// ponytail: window.BarcodeDetector only — full types exist in @types/wicg-file-system-access
// but we don't need a dependency for one global.
interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
