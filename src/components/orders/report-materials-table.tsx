'use client'

import { Package } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'
import type { ServiceReportMaterial } from '@/lib/service-report'

interface ReportMaterialsTableProps {
  materials: ServiceReportMaterial[]
}

export function ReportMaterialsTable({ materials }: ReportMaterialsTableProps) {
  const total = materials.reduce((sum, m) => sum + (m.total ?? m.qty * m.unit_price), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4 text-muted-foreground" />
        Material yang dipakai
        <span className="text-xs font-normal text-muted-foreground">
          ({materials.length})
        </span>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Tidak ada material tambahan.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Harga</TableHead>
                <TableHead className="w-32 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material, idx) => (
                <TableRow key={(material.addon_id ?? material.name) + idx}>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell className="text-right">{material.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(material.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(material.total ?? material.qty * material.unit_price)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">
                  Total Material
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
