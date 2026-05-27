'use client'

import { useState, useRef, useEffect } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (option.secondaryLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const handleSelect = (optionId: string) => {
    onValueChange(optionId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Dropdown trigger button */}
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

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 w-full bg-white border rounded-lg shadow-lg z-50 max-h-[60vh] sm:max-h-80 overflow-hidden flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 bg-white">
            <Input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 sm:h-8 text-sm"
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value === option.id
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 hover:bg-gray-100 cursor-pointer border-b last:border-b-0",
                      isSelected && "bg-blue-50"
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
        </div>
      )}
    </div>
  )
}
