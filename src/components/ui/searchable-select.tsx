'use client'

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  id: string
  label: string
  secondaryLabel?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

interface DropdownRect {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
  placement: 'bottom' | 'top'
}

const GAP = 4
const DEFAULT_MAX_H = 320

/**
 * Viewport-only coords for position:fixed.
 * Do NOT add scrollY/scrollX — getBoundingClientRect is already viewport-relative.
 *
 * Portal + Radix Dialog:
 * - Dialog sets body { pointer-events: none }; only DialogContent gets auto.
 * - Portaled menu MUST set pointer-events: auto or it is untouchable.
 * - Wrap in DismissableLayerBranch so outside-dismiss ignores menu clicks
 *   (React context still flows through createPortal).
 */
function useDropdownRect(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean
) {
  const [rect, setRect] = useState<DropdownRect>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: DEFAULT_MAX_H,
    placement: 'bottom',
  })

  const compute = useCallback(() => {
    if (!ref.current) return
    const box = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - box.bottom - GAP
    const spaceAbove = box.top - GAP
    const placeTop = spaceBelow < 160 && spaceAbove > spaceBelow
    const maxHeight = Math.min(
      DEFAULT_MAX_H,
      Math.max(120, placeTop ? spaceAbove : spaceBelow)
    )

    setRect(
      placeTop
        ? {
            bottom: window.innerHeight - box.top + GAP,
            left: box.left,
            width: box.width,
            maxHeight,
            placement: 'top',
          }
        : {
            top: box.bottom + GAP,
            left: box.left,
            width: box.width,
            maxHeight,
            placement: 'bottom',
          }
    )
  }, [ref])

  useLayoutEffect(() => {
    if (!isOpen) return
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [isOpen, compute])

  return rect
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select item...',
  searchPlaceholder = 'Search...',
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const rect = useDropdownRect(containerRef, isOpen)

  useEffect(() => {
    setMounted(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
  }, [])

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideDropdown = dropdownRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideDropdown) close()
    },
    [close]
  )

  useEffect(() => {
    if (!isOpen) return
    // click (not mousedown): let option handlers run first
    document.addEventListener('mousedown', handleClickOutside)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, handleClickOutside, close])

  const filteredOptions = options.filter((option) => {
    const label = option.label ?? ''
    const secondaryLabel = option.secondaryLabel ?? ''
    const q = searchQuery.toLowerCase()
    return (
      label.toLowerCase().includes(q) || secondaryLabel.toLowerCase().includes(q)
    )
  })

  const handleSelect = (optionId: string) => {
    onValueChange(optionId)
    close()
  }

  const selectedOption = options.find((opt) => opt.id === value)

  const dropdownStyle: React.CSSProperties =
    rect.placement === 'top'
      ? {
          position: 'fixed',
          top: 'auto',
          bottom: rect.bottom ?? 0,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxHeight,
          zIndex: 100,
          // Critical: Dialog sets body pointer-events:none
          pointerEvents: 'auto',
        }
      : {
          position: 'fixed',
          top: rect.top ?? 0,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxHeight,
          zIndex: 100,
          pointerEvents: 'auto',
        }

  const dropdown = (
    <DismissableLayerBranch asChild>
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className="bg-background border border-border rounded-lg shadow-lg overflow-hidden flex flex-col"
        role="listbox"
        data-floating-outside=""
      >
        <div className="p-2 border-b border-border sticky top-0 bg-background">
          <Input
            ref={inputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 sm:h-8 text-sm"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = value === option.id
              return (
                <div
                  key={option.id}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 hover:bg-muted cursor-pointer border-b border-border last:border-b-0',
                    isSelected && 'bg-primary/5'
                  )}
                  onMouseDown={(e) => {
                    // mousedown (not click): fires before outside-dismiss path
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelect(option.id)
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{option.label}</div>
                    {option.secondaryLabel && (
                      <div className="text-xs text-muted-foreground truncate">
                        {option.secondaryLabel}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 shrink-0 text-primary" />
                  )}
                </div>
              )
            })
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      </div>
    </DismissableLayerBranch>
  )

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between min-h-[44px] sm:min-h-10"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) {
            close()
          } else {
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      >
        <span
          className={cn(
            'truncate',
            selectedOption ? '' : 'text-muted-foreground'
          )}
        >
          {selectedOption ? (
            <span>
              {selectedOption.label}
              {selectedOption.secondaryLabel && (
                <span className="text-muted-foreground ml-1">
                  ({selectedOption.secondaryLabel})
                </span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 transition-transform',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </Button>

      {isOpen && mounted && createPortal(dropdown, document.body)}
    </div>
  )
}
