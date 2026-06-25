import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Pencil, Trash2, Package, Plus } from 'lucide-react'
import type { Addon } from '@/lib/actions/addons'

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-status-assigned-bg text-status-assigned' },
  { value: 'FREON', label: 'Freon', color: 'bg-status-invoiced text-foreground' },
  { value: 'LABOR', label: 'Labor', color: 'bg-status-pending-bg text-status-pending' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-muted-foreground text-background' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-muted-foreground text-background' },
]

export function getCategoryColor(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.color || 'bg-muted-foreground'
}

export function getCategoryLabel(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.label || category
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

interface AddonsTableProps {
  addons: Addon[]
  isFetching: boolean
  onEdit: (addon: Addon) => void
  onDelete: (addon: Addon) => void
  onAddNew: () => void
}

export function AddonsTable({
  addons,
  isFetching,
  onEdit,
  onDelete,
  onAddNew,
}: AddonsTableProps) {
  if (isFetching) {
    return <TableSkeleton rows={6} columns={7} />
  }

  if (addons.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Belum ada add-ons"
        description="Tambahkan item pertama ke katalog untuk mulai menggunakan add-ons di order."
        action={{
          label: 'Tambah Item',
          icon: Plus,
          onClick: onAddNew,
        }}
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm bg-card">
      <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead className="hidden sm:table-cell">Kategori</TableHead>
            <TableHead className="hidden lg:table-cell">Kode</TableHead>
            <TableHead>Nama Item</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead className="hidden md:table-cell">Satuan</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addons.map((addon) => (
            <TableRow key={addon.addon_id} className="border-0 hover:bg-muted/50">
              <TableCell className="hidden sm:table-cell">
                  <Badge className={`${getCategoryColor(addon.category)} whitespace-nowrap hover:bg-inherit`}>
                  {getCategoryLabel(addon.category)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell font-mono text-xs">
                {addon.item_code || '-'}
              </TableCell>
              <TableCell className="font-medium">
                <div>{addon.item_name}</div>
                <div className="flex flex-wrap gap-1.5 mt-1 sm:hidden">
                <Badge className={`${getCategoryColor(addon.category)} whitespace-nowrap hover:bg-inherit`}>
                    {getCategoryLabel(addon.category)}
                  </Badge>
                  {addon.item_code && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {addon.item_code}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(addon.unit_price)}</TableCell>
              <TableCell className="hidden md:table-cell">{addon.unit_of_measure}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(addon)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(addon)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
