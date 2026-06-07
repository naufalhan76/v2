'use client'

import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, Loader2, Check } from 'lucide-react'

interface SwipeToActionProps {
  onAction: () => Promise<void> | void
  text?: string
  completedText?: string
  isLoading?: boolean
  className?: string
}

export function SwipeToAction({
  onAction,
  text = 'Geser untuk berangkat',
  completedText = 'Berangkat!',
  isLoading = false,
  className
}: SwipeToActionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [xPos, setXPos] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const startX = useRef(0)
  const maxTravel = useRef(0)
  
  useEffect(() => {
    if (containerRef.current) {
      // 56px is the width of the thumb (14 * 4), plus 4px padding on each side (8px total)
      maxTravel.current = containerRef.current.clientWidth - 56 - 8
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted || isLoading) return
    setIsDragging(true)
    startX.current = e.clientX - xPos
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isCompleted || isLoading) return
    
    let newX = e.clientX - startX.current
    if (newX < 0) newX = 0
    if (newX > maxTravel.current) newX = maxTravel.current
    
    setXPos(newX)
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)

    if (xPos >= maxTravel.current * 0.85) {
      // Snap to end
      setXPos(maxTravel.current)
      setIsCompleted(true)
      try {
        await onAction()
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
        "relative h-16 w-full rounded-full bg-canvas-soft overflow-hidden select-none touch-none border border-hairline transition-colors duration-300",
        isCompleted && "bg-primary border-primary dark:bg-primary dark:border-primary shadow-inner",
        className
      )}
    >
      {/* Progress Track Fill */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 bg-primary/20 dark:bg-primary/20 border-r border-primary/30",
          !isDragging && "transition-all duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          isCompleted && "bg-primary dark:bg-primary border-none",
          isLoading && "bg-primary/20 dark:bg-primary/20 border-none animate-pulse"
        )}
        style={{ width: isCompleted ? '100%' : isLoading ? '100%' : `${xPos + 56 + 8}px` }}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <span 
          className={cn(
            "text-[15px] font-medium transition-opacity duration-200 text-ink-mute"
          )}
          style={{ 
            opacity: isLoading || isCompleted ? 0 : Math.max(0, 1 - (xPos / (maxTravel.current || 1)) * 1.5)
          }}
        >
          {text}
        </span>
      </div>

      {(isLoading || isCompleted) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-300">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <div className="flex items-center gap-2 text-white animate-in slide-in-from-bottom-2 duration-300 delay-75">
              <Check className="h-5 w-5" />
              <span className="font-semibold">{completedText}</span>
            </div>
          )}
        </div>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "absolute left-1 top-1 bottom-1 w-14 rounded-full bg-primary flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg z-30",
          !isDragging && "transition-transform duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          (isCompleted || isLoading) && "opacity-0 scale-50 pointer-events-none transition-all duration-300"
        )}
        style={{ transform: `translateX(${xPos}px)` }}
      >
        {/* Pulsing ring inside the thumb to invite interaction */}
        {!isDragging && !isCompleted && !isLoading && (
          <span className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping opacity-60 pointer-events-none" />
        )}
        <ChevronRight className={cn(
          "h-6 w-6 text-primary-foreground transition-transform duration-300",
          isDragging && "scale-110"
        )} />
      </div>
    </div>
  )
}
