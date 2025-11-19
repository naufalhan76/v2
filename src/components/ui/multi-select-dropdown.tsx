'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { X, ChevronDown } from 'lucide-react'

export interface MultiSelectOption {
  id: string
  label: string
  secondaryLabel?: string
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[]
  selected: string[]
  onSelectionChange: (selectedIds: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
}

export function MultiSelectDropdown({
  options,
  selected,
  onSelectionChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
}: MultiSelectDropdownProps) {
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
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (option.secondaryLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const handleToggleOption = (optionId: string) => {
    const newSelected = selected.includes(optionId)
      ? selected.filter(id => id !== optionId)
      : [...selected, optionId]
    onSelectionChange(newSelected)
  }

  const handleRemoveSelected = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange(selected.filter(id => id !== optionId))
  }

  const selectedOptions = options.filter(opt => selected.includes(opt.id))

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected items display */}
      <div className="mb-2">
        {selectedOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map(option => (
              <div
                key={option.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm"
              >
                <span>{option.label}</span>
                {option.secondaryLabel && (
                  <span className="text-xs text-blue-700">({option.secondaryLabel})</span>
                )}
                <button
                  onClick={(e) => handleRemoveSelected(option.id, e)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dropdown trigger button */}
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      >
        <span className="text-muted-foreground">
          {selectedOptions.length > 0
            ? `${selectedOptions.length} selected`
            : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 bg-white">
            <Input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleToggleOption(option.id)}
                >
                  <Checkbox
                    checked={selected.includes(option.id)}
                    onCheckedChange={() => handleToggleOption(option.id)}
                    className="cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.secondaryLabel && (
                      <div className="text-xs text-muted-foreground">{option.secondaryLabel}</div>
                    )}
                  </div>
                </div>
              ))
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
