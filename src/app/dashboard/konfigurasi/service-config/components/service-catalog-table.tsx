'use client'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Pencil, Trash2 } from 'lucide-react'

export interface ServiceCatalogItem {
  catalog_id: string
  msn_code: string
  unit_type_id?: string
  capacity_id?: string
  service_type_id?: string
  service_name: string
  base_price: number
  description?: string | null
  is_active?: boolean
  unit_types?: { name: string }
  capacity_ranges?: { capacity_label: string }
  service_types?: { name: string }
}

interface ServiceCatalogTableProps {
  items: ServiceCatalogItem[]
  isFetching: boolean
  onEdit: (item: ServiceCatalogItem) => void
  onDelete: (item: ServiceCatalogItem) => void
}

export function ServiceCatalogTable({ items, isFetching, onEdit, onDelete }: ServiceCatalogTableProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  if (isFetching) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 shadow-sm bg-card">
      <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead>MSN Code</TableHead>
            <TableHead>Type AC</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Service Group</TableHead>
            <TableHead>Deskripsi Service</TableHead>
            <TableHead>Harga Base</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.catalog_id} className="border-0 hover:bg-muted/50">
              <TableCell className="font-mono font-bold text-primary">{item.msn_code}</TableCell>
              <TableCell>{item.unit_types?.name}</TableCell>
              <TableCell>{item.capacity_ranges?.capacity_label}</TableCell>
              <TableCell><span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs">{item.service_types?.name}</span></TableCell>
              <TableCell className="font-medium">{item.service_name}</TableCell>
              <TableCell>{formatCurrency(item.base_price)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow className="border-0">
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Tidak ada data catalog.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
