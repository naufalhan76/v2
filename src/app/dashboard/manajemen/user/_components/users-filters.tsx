import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface UsersFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function UsersFilters({ searchQuery, onSearchChange }: UsersFiltersProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        placeholder="Cari user..."
        className="max-w-full sm:max-w-sm"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  )
}
