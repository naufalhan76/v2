'use client'

import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Trash2, SearchX, Inbox } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { CancelModal } from '@/components/orders/cancel-modal'
import { type OrderForDisplay } from '@/lib/order-utils'
import { createOrdersListColumns } from './orders-list-columns'
import { OrdersListMobileCard } from './orders-list-mobile-card'

interface OrdersListViewProps {
  orders: OrderForDisplay[]
  isLoading: boolean
  hasFilters: boolean
  onRowClick: (orderId: string) => void
}

export function OrdersListView({ orders, isLoading, hasFilters, onRowClick }: OrdersListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [bulkCancelOrderId, setBulkCancelOrderId] = useState<string | null>(null)

  const columns = useMemo(() => createOrdersListColumns(onRowClick, setBulkCancelOrderId), [onRowClick])

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.order_id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={hasFilters ? SearchX : Inbox}
        title={hasFilters ? 'Tidak ditemukan' : 'Belum ada order'}
        description={
          hasFilters
            ? 'Coba ubah filter pencarian.'
            : 'Order baru akan muncul di sini setelah dibuat.'
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-canvas-soft px-3 py-2">
          <p className="text-base text-ink-mute">{selectedIds.length} order dipilih</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkCancelOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-3 w-3" />
            Batalkan terpilih
          </Button>
        </div>
      )}

      <div className="rounded-lg border hidden md:block">
        <Table>
          <TableCaption className="sr-only">Orders list</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                role="link"
                onClick={() => onRowClick(row.original.order_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRowClick(row.original.order_id)
                }}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-2">
        {table.getRowModel().rows.map((row) => (
          <OrdersListMobileCard
            key={row.id}
            row={row}
            onRowClick={onRowClick}
            onCancel={setBulkCancelOrderId}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-ink-mute">
          Menampilkan {table.getRowModel().rows.length} dari {orders.length} order
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-10 flex-1 sm:h-9 sm:flex-none"
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-10 flex-1 sm:h-9 sm:flex-none"
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <CancelModal
        open={!!bulkCancelOrderId}
        onOpenChange={(o) => !o && setBulkCancelOrderId(null)}
        orderId={bulkCancelOrderId}
      />

      <CancelModal
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        orderId={selectedIds[0] ?? null}
        onSuccess={() => {
          setRowSelection({})
        }}
      />
    </div>
  )
}
