'use client'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-status-assigned-bg' },
  { value: 'FREON', label: 'Freon', color: 'bg-status-invoiced' },
  { value: 'LABOR', label: 'Labor', color: 'bg-status-pending-bg' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-primary' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-muted-foreground' },
]

interface AddonsFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
}

export function AddonsFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
}: AddonsFiltersProps) {
  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan nama atau kode item..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
          </div>
          <Tabs
            value={categoryFilter}
            onValueChange={onCategoryFilterChange}
            className="w-auto"
          >
            <TabsList className="rounded-xl border border-border/50 bg-muted/50 p-1">
              <TabsTrigger value="ALL" className="rounded-lg">Semua</TabsTrigger>
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value} className="rounded-lg">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
