import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface TechnicianFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function TechnicianFilters({ searchQuery, onSearchChange }: TechnicianFiltersProps) {
  return (
    <div className="mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search by name, phone, email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  )
}
