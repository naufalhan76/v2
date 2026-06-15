'use client'

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  type ServiceCatalogEntry,
  toggleCatalogActive,
} from '@/lib/actions/service-catalog'

const formatIDR = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0)

export function useCatalogToggleMutation() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await toggleCatalogActive(id, isActive)
      if (!res.success) throw new Error(res.error || 'Gagal mengubah status')
      return res.data!
    },
    onSuccess: (_, vars) => {
      toast({
        title: 'Status diperbarui',
        description: vars.isActive ? 'Catalog diaktifkan.' : 'Catalog dinonaktifkan.',
      })
      queryClient.invalidateQueries({ queryKey: ['service-catalog-grouped'] })
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message })
    },
  })
}

interface CatalogGroupTableProps {
  data: ServiceCatalogEntry[]
  onEdit: (entry: ServiceCatalogEntry) => void
  toggleMutation: ReturnType<typeof useCatalogToggleMutation>
}

export function CatalogGroupTable({ data, onEdit, toggleMutation }: CatalogGroupTableProps) {
  const columns = useMemo<ColumnDef<ServiceCatalogEntry>[]>(
    () => [
      {
        accessorKey: 'msn_code',
        header: 'MSN Code',
        cell: ({ row }) => (
          <span className="font-mono text-lg text-foreground">
            {row.original.msn_code}
          </span>
        ),
      },
      {
        accessorKey: 'service_name',
        header: 'Nama Service',
        cell: ({ row }) => <span className="text-lg text-foreground">{row.original.service_name}</span>,
      },
      {
        id: 'capacity',
        header: 'Kapasitas',
        accessorFn: (row) => row.capacity_ranges?.capacity_label ?? '-',
        cell: ({ getValue }) => (
          <span className="text-lg text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: 'service_type',
        header: 'Service Type',
        accessorFn: (row) => row.service_types?.code ?? '-',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="font-normal bg-surface-muted text-foreground border-border">
            {getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'base_price',
        header: () => <div className="text-right">Harga Base</div>,
        cell: ({ row }) => (
          <div className="text-right font-bold text-xl tabular-nums text-foreground">
            {formatIDR(row.original.base_price)}
          </div>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-status-completed/10 text-status-completed border-status-completed/20 hover:bg-status-completed/10">
              Aktif
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground border-border">
              Nonaktif
            </Badge>
          ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const entry = row.original
          const isToggling =
            toggleMutation.isPending && toggleMutation.variables?.id === entry.catalog_id
          return (
            <div className="flex items-center justify-end gap-2">
              <Switch
                checked={entry.is_active}
                disabled={isToggling}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ id: entry.catalog_id, isActive: checked })
                }
                aria-label="Toggle aktif"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                aria-label="Edit"
                className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggleMutation.isPending, toggleMutation.variables?.id, onEdit]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta as { className?: string } | undefined
                return (
                  <TableHead key={h.id} className={meta?.className}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-surface-muted">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as { className?: string } | undefined
                return (
                  <TableCell key={cell.id} className={meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
