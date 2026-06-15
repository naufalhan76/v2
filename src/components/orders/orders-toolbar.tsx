import Link from 'next/link'
import { Download, LayoutGrid, List, Plus, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface OrdersToolbarProps {
  view: 'board' | 'list'
  canBulkAssign: boolean
  selectionMode: boolean
  isLoading: boolean
  filteredCount: number
  onViewChange: (view: 'board' | 'list') => void
  onToggleSelectionMode: () => void
  onExportCsv: () => void
}

export function OrdersToolbar({
  view,
  canBulkAssign,
  selectionMode,
  isLoading,
  filteredCount,
  onViewChange,
  onToggleSelectionMode,
  onExportCsv,
}: OrdersToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold sm:text-2xl">Orders</h1>
        <p className="text-base text-muted-foreground">Kelola semua order dalam satu dashboard</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as 'board' | 'list')} className="flex-1 sm:flex-none">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="board" className="flex-1 gap-1.5 sm:flex-none">
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 gap-1.5 sm:flex-none">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {canBulkAssign && view === 'board' && (
          <Button
            variant={selectionMode ? 'default' : 'outline'}
            onClick={onToggleSelectionMode}
            className="h-11 sm:h-9 gap-1.5"
          >
            {selectionMode ? (
              <><X className="h-4 w-4" /> Batal Mode Pilih</>
            ) : (
              <><UserCheck className="h-4 w-4" /> Pilih Order</>
            )}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onExportCsv}
          disabled={isLoading || filteredCount === 0}
          className="h-11 sm:h-9 gap-1.5"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button asChild className="h-11 sm:h-9">
          <Link href="/dashboard/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Buat Order
          </Link>
        </Button>
      </div>
    </div>
  )
}
