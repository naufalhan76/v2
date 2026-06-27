'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current && !containerRef.current.contains(event.target as Node) &&
      dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen, updatePosition, handleClickOutside])

  const filteredOptions = options.filter(option => {
    const label = option.label ?? ''
    const secondaryLabel = option.secondaryLabel ?? ''
    return label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      secondaryLabel.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSelect = (optionId: string) => {
    onValueChange(optionId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between min-h-[44px] sm:min-h-10"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      >
        <span className={cn("truncate", selectedOption ? "" : "text-muted-foreground")}>
          {selectedOption ? (
            <span>
              {selectedOption.label}
              {selectedOption.secondaryLabel && (
                <span className="text-muted-foreground ml-1">({selectedOption.secondaryLabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", isOpen ? 'rotate-180' : '')} />
      </Button>

      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="bg-background border border-border rounded-lg shadow-lg z-[100] max-h-[60vh] sm:max-h-80 overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-border sticky top-0 bg-background">
            <Input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 sm:h-8 text-sm"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value === option.id
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 hover:bg-surface-muted cursor-pointer border-b border-border last:border-b-0",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => handleSelect(option.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{option.label}</div>
                      {option.secondaryLabel && (
                        <div className="text-xs text-muted-foreground truncate">{option.secondaryLabel}</div>
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
        </div>,
        document.body
      )}
    </div>
  )
}
