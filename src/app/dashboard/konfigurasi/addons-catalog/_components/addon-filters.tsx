import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search } from 'lucide-react'

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts' },
  { value: 'FREON', label: 'Freon' },
  { value: 'LABOR', label: 'Labor' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'OTHER', label: 'Lainnya' },
]

interface AddonFiltersProps {
  searchQuery: string
  categoryFilter: string
  onSearchChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

export function AddonFilters({
  searchQuery,
  categoryFilter,
  onSearchChange,
  onCategoryChange,
}: AddonFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan nama atau kode item..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:w-auto">
        <Tabs
          value={categoryFilter}
          onValueChange={onCategoryChange}
          className="w-auto"
        >
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="ALL">Semua</TabsTrigger>
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
