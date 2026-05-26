'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import SignaturePadLib from 'signature_pad'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  /** Called with base64 PNG data URL when signature changes */
  onChange: (dataUrl: string | null) => void
  /** Initial value (base64 data URL) to restore from draft */
  value?: string | null
  /** Disable interaction */
  disabled?: boolean
  /** Additional className for the container */
  className?: string
}

export function SignaturePad({ onChange, value, disabled = false, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  // Initialize signature pad
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

    // Restore value if provided
    if (value) {
      pad.fromDataURL(value, {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      })
      setIsEmpty(false)
    }

    // Listen for end of stroke
    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
      if (!pad.isEmpty()) {
        onChange(pad.toDataURL('image/png'))
      }
    })

    if (disabled) {
      pad.off()
    }

    return () => {
      pad.off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

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

  const handleClear = useCallback(() => {
    const pad = padRef.current
    if (!pad) return
    pad.clear()
    setIsEmpty(true)
    onChange(null)
  }, [onChange])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Tanda Tangan Customer</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="h-8 text-xs"
        >
          <Eraser className="mr-1 h-3.5 w-3.5" />
          Hapus
        </Button>
      </div>

      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed',
          disabled ? 'opacity-50 pointer-events-none' : 'border-muted-foreground/30',
          !isEmpty && 'border-solid border-primary/30'
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
            <p className="text-sm text-muted-foreground/50">
              Tanda tangan di sini
            </p>
          </div>
        )}
      </div>

      {isEmpty && !disabled && (
        <p className="text-xs text-muted-foreground">
          Minta customer untuk menandatangani di area di atas
        </p>
      )}
    </div>
  )
}
