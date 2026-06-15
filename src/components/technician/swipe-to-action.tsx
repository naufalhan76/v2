'use client'

import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, Loader2 } from 'lucide-react'

export interface SwipeToActionProps {
  onComplete: () => void | Promise<void>
  label?: string
  disabled?: boolean
  loading?: boolean
}

export function SwipeToAction({
  onComplete,
  label = 'Geser untuk Berangkat',
  disabled = false,
  loading = false
}: SwipeToActionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [xPos, setXPos] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const startX = useRef(0)
  const maxTravel = useRef(0)
  
  useEffect(() => {
    if (containerRef.current) {
      // Container width minus thumb width (48px) and paddings (8px left + 8px right = 16px)
      maxTravel.current = containerRef.current.clientWidth - 48 - 16
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || loading || isCompleted) return
    setIsDragging(true)
    startX.current = e.clientX - xPos
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled || loading || isCompleted) return
    
    let newX = e.clientX - startX.current
    if (newX < 0) newX = 0
    if (newX > maxTravel.current) newX = maxTravel.current
    
    setXPos(newX)
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    if (e.currentTarget.releasePointerCapture) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (xPos >= maxTravel.current * 0.8) {
      // Snap to end
      setXPos(maxTravel.current)
      setIsCompleted(true)
      
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50)
      }
      
      try {
        await onComplete()
      } catch (_err) {
        setIsCompleted(false)
        setXPos(0)
      }
    } else {
      // Snap back
      setXPos(0)
    }
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative h-16 w-full rounded-full bg-primary p-2 overflow-hidden select-none touch-pan-y transition-colors duration-300",
        (disabled || loading) && "opacity-70 cursor-not-allowed"
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <span 
            className="text-white font-semibold text-sm transition-opacity duration-200"
            style={{ 
              opacity: isCompleted ? 0 : Math.max(0, 1 - (xPos / (maxTravel.current || 1)) * 1.5)
            }}
          >
            {label}
          </span>
        )}
      </div>

      <div
        data-testid="swipe-thumb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "absolute left-2 top-2 bottom-2 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md z-30 touch-none",
          !isDragging && "transition-transform duration-300 ease-out",
          !disabled && !loading && "cursor-grab active:cursor-grabbing",
          isCompleted && "opacity-0 scale-50 transition-all duration-300"
        )}
        style={{ transform: `translateX(${xPos}px)` }}
      >
        <ChevronRight className={cn(
          "h-6 w-6 text-primary transition-transform duration-300",
          isDragging && "scale-110"
        )} />
      </div>
    </div>
  )
}