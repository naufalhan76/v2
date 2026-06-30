import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"

const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({ toast: mockToast }),
}))

describe("useBarcodeScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error — removing BarcodeDetector for unsupported test
    delete window.BarcodeDetector
    // ponytail: jsdom lacks mediaDevices; stub minimally
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn() },
      writable: true,
      configurable: true,
    })
    // ponytail: stub secure context so HTTPS check passes
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  it("returns isSupported=false when BarcodeDetector is unavailable", () => {
    const onDetected = vi.fn()
    const { result } = renderHook(() => useBarcodeScanner({ onDetected }))
    expect(result.current.isSupported).toBe(false)
    expect(result.current.isScanning).toBe(false)
  })

  it("returns isSupported=true when BarcodeDetector exists", () => {
    // @ts-expect-error — minimal mock for feature-detection
    window.BarcodeDetector = class {}
    const onDetected = vi.fn()
    const { result } = renderHook(() => useBarcodeScanner({ onDetected }))
    expect(result.current.isSupported).toBe(true)
  })

  it("startScanning shows toast when getUserMedia rejects", async () => {
    // @ts-expect-error — minimal mock
    window.BarcodeDetector = class {}
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
      new Error("NotAllowedError"),
    )
    const onDetected = vi.fn()
    const { result } = renderHook(() => useBarcodeScanner({ onDetected }))

    await act(async () => {
      await result.current.startScanning()
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Kamera tidak tersedia" }),
    )
    expect(result.current.isScanning).toBe(false)
  })

  it("startScanning does nothing when unsupported", async () => {
    const onDetected = vi.fn()
    const { result } = renderHook(() => useBarcodeScanner({ onDetected }))
    await act(async () => {
      await result.current.startScanning()
    })
    expect(result.current.isScanning).toBe(false)
    expect(mockToast).not.toHaveBeenCalled()
  })
})
