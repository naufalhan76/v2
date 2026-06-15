import { TableHead } from '@/components/ui/table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortConfig } from '@/hooks/use-sortable-table'

interface SortableTableHeadProps {
  sortKey: string
  currentSort: SortConfig
  onSort: (key: string) => void
  children: React.ReactNode
  className?: string
}

export function SortableTableHead({
  sortKey,
  currentSort,
  onSort,
  children,
  className
}: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <TableHead className={cn('cursor-pointer select-none hover:bg-muted/50', className)}>
      <div
        className="flex items-center gap-2"
        onClick={() => onSort(sortKey)}
      >
        <span>{children}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          {!isActive && (
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
          )}
          {isActive && direction === 'asc' && (
            <ArrowUp className="w-3.5 h-3.5 text-primary" />
          )}
          {isActive && direction === 'desc' && (
            <ArrowDown className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
      </div>
    </TableHead>
  )
}
