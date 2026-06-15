'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface AddonOption {
  addon_id: string
  item_name: string
  category: string
  unit_price: number
  unit_of_measure: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface AddonSearchInputProps {
  value: string
  addons: AddonOption[]
  onSelect: (addon: AddonOption) => void
  disabled?: boolean
  placeholder?: string
}

export function AddonSearchInput({
  value,
  addons,
  onSelect,
  disabled,
  placeholder,
}: AddonSearchInputProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const grouped = useMemo(() => {
    if (!query.trim()) return {} as Record<string, AddonOption[]>
    const q = query.toLowerCase()
    const filtered = addons.filter(
      (a) =>
        a.item_name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    )
    const groups: Record<string, AddonOption[]> = {}
    filtered.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    })
    return groups
  }, [addons, query])

  const totalMatches = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div ref={ref} className="relative flex-1">
      <Input
        placeholder={placeholder || 'Nama material'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (query.trim()) setOpen(true) }}
        disabled={disabled}
        className="h-10 flex-1 text-sm pr-8"
      />
      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

      {open && totalMatches > 0 && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background dark:bg-surface-muted border border-border dark:border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-surface-muted dark:bg-surface sticky top-0">
                {category}
              </div>
              {items.map((addon) => (
                <button
                  key={addon.addon_id}
                  type="button"
                  onClick={() => {
                    onSelect(addon)
                    setQuery(addon.item_name)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted dark:hover:bg-surface transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{addon.item_name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatCurrency(addon.unit_price)}/{addon.unit_of_measure}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { formatCurrency }
export type { AddonOption }
