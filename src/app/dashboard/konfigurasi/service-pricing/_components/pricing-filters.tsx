'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_TYPES = 'ALL'

const SERVICE_TYPES = [
  { value: ALL_TYPES, label: 'Semua Jenis' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REFILL_FREON', label: 'Refill Freon' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSTALLATION', label: 'Instalasi' },
  { value: 'INSPECTION', label: 'Inspeksi' },
]

interface PricingFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  typeFilter: string
  onTypeFilterChange: (value: string) => void
}

export function PricingFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: PricingFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input
        placeholder="Cari service..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-10 sm:max-w-xs"
      />
      <Select
        value={typeFilter || ALL_TYPES}
        onValueChange={(v) => onTypeFilterChange(v === ALL_TYPES ? '' : v)}
      >
        <SelectTrigger className="h-10 sm:w-[200px]">
          <SelectValue placeholder="Filter jenis" />
        </SelectTrigger>
        <SelectContent>
          {SERVICE_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
