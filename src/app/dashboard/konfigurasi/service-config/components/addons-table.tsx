'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Package, Pencil, Trash2 } from 'lucide-react'
import type { Addon } from '@/lib/actions/addons'

const CATEGORIES = [
  { value: 'PARTS', label: 'Parts', color: 'bg-status-assigned-bg' },
  { value: 'FREON', label: 'Freon', color: 'bg-status-invoiced' },
  { value: 'LABOR', label: 'Labor', color: 'bg-status-pending-bg' },
  { value: 'TRANSPORTATION', label: 'Transportation', color: 'bg-primary' },
  { value: 'OTHER', label: 'Lainnya', color: 'bg-muted-foreground' },
]

interface AddonsTableProps {
  addons: Addon[]
  isFetching: boolean
  onEdit: (addon: Addon) => void
  onDelete: (addon: Addon) => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function getCategoryColor(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.color || 'bg-muted-foreground'
}

function getCategoryLabel(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.label || category
}

export function AddonsTable({ addons, isFetching, onEdit, onDelete }: AddonsTableProps) {
  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (addons.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Belum ada add-ons</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Mulai dengan menambahkan item pertama ke katalog
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 shadow-sm bg-card">
      <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead>Kategori</TableHead>
            <TableHead>Kode</TableHead>
            <TableHead>Nama Item</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead>Satuan</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addons.map((addon) => (
            <TableRow key={addon.addon_id} className="border-0 hover:bg-muted/50">
              <TableCell>
                <Badge className={getCategoryColor(addon.category)}>
                  {getCategoryLabel(addon.category)}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {addon.item_code || '-'}
              </TableCell>
              <TableCell className="font-medium">
                {addon.item_name}
              </TableCell>
              <TableCell>{formatCurrency(addon.unit_price)}</TableCell>
              <TableCell>{addon.unit_of_measure}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(addon)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(addon)}
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
