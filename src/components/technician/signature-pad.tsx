'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import SignaturePadLib from 'signature_pad'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SignaturePadProps {
  /** Called with base64 PNG data URL when signature changes */
  onChange: (dataUrl: string | null) => void
  /** Called with a PNG Blob when the user finishes a stroke; null when cleared */
  onBlobChange?: (blob: Blob | null) => void
  /** Initial value (base64 data URL) to restore from draft */
  value?: string | null
  /** Disable interaction */
  disabled?: boolean
  /** Additional className for the container */
  className?: string
}

export function SignaturePad({ onChange, onBlobChange, value, disabled = false, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  // Keep callback refs current on every render — prevents stale closures in event listeners
  const onChangeRef = useRef(onChange)
  const onBlobChangeRef = useRef(onBlobChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onBlobChangeRef.current = onBlobChange
  })

  // Guards so the init block only runs once; re-runs on disabled toggle are fine
  const initializedRef = useRef(false)

  // Initialize signature pad — re-runs only when disabled changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas resolution for retina displays
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
    }

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    })

    padRef.current = pad

    // Restore initial value only on first mount — subsequent value changes
    // are handled by the dedicated value-sync effect below
    if (!initializedRef.current && value) {
      pad.fromDataURL(value, {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      })
      setIsEmpty(false)
    }
    initializedRef.current = true

    // Listen for end of stroke — reads refs so we always call the latest callbacks
    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
      if (!pad.isEmpty()) {
        onChangeRef.current?.(pad.toDataURL('image/png'))
        if (onBlobChangeRef.current) {
          canvas.toBlob((blob) => onBlobChangeRef.current?.(blob), 'image/png')
        }
      }
    })

    if (disabled) {
      pad.off()
    }

    return () => {
      pad.off()
    }
    // onChange/onBlobChange intentionally omitted — accessed via refs
    // value intentionally omitted — initial restore handled above; post-mount changes below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  // Sync value prop changes after mount (e.g. external clear or draft restore)
  useEffect(() => {
    const pad = padRef.current
    const canvas = canvasRef.current
    // Skip until the pad has been initialised by the effect above
    if (!pad || !canvas || !initializedRef.current) return

    if (value) {
      // Only re-apply when the value actually differs to avoid redundant redraws
      if (value !== pad.toDataURL('image/png')) {
        pad.fromDataURL(value, {
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        })
        setIsEmpty(false)
      }
    } else {
      // null / undefined — clear if the pad still has content
      if (!pad.isEmpty()) {
        pad.clear()
        setIsEmpty(true)
      }
    }
  }, [value])

  // Handle resize
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current
      const pad = padRef.current
      if (!canvas || !pad) return

      const data = pad.toData()
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
      }
      pad.clear()
      pad.fromData(data)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Reads refs so the clear button always calls the latest callbacks
  const handleClear = useCallback(() => {
    const pad = padRef.current
    if (!pad) return
    pad.clear()
    setIsEmpty(true)
    onChangeRef.current?.(null)
    onBlobChangeRef.current?.(null)
  }, []) // onChange/onBlobChange intentionally omitted — accessed via refs

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Tanda Tangan Customer</label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="h-9 px-3 text-xs font-medium text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200 active:scale-[0.96]"
        >
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Hapus
        </Button>
      </div>

      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed border-hairline dark:border-gray-600 bg-background dark:bg-[#252243] overflow-hidden',
          disabled ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors duration-200',
          !isEmpty && 'border-solid border-indigo-300 dark:border-indigo-600'
        )}
      >
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: '200px', minHeight: '200px' }}
          aria-label="Area tanda tangan customer"
        />

        {/* Placeholder text when empty */}
        {isEmpty && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-ink-faint">
              Tanda tangan di sini
            </p>
          </div>
        )}
      </div>

      {isEmpty && !disabled && (
        <p className="text-xs text-ink-mute">
          Minta customer untuk menandatangani di area di atas
        </p>
      )}
    </div>
  )
}
