'use client'

import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ArrowUpDown, MoreHorizontal, Trash2, SearchX, Inbox, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import { CancelModal } from '@/components/orders/cancel-modal'
import {
  type OrderForDisplay,
  getLeadTechnicianName,
  getPrimaryServiceType,
} from '@/lib/order-utils'

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

  const columns: ColumnDef<OrderForDisplay>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Pilih semua"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Pilih baris"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'order_id',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3"
          >
            Order ID <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.order_id}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.customers?.customer_name ?? '-'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
      },
      {
        id: 'service_type',
        header: 'Service',
        cell: ({ row }) => {
          const t = getPrimaryServiceType(row.original)
          return t ? <ServiceTypeBadge serviceType={t} size="sm" /> : '-'
        },
      },
      {
        accessorKey: 'scheduled_visit_date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3"
          >
            Jadwal <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const d = row.original.scheduled_visit_date ?? row.original.req_visit_date
          return d ? (
            <span className="text-xs">
              {format(new Date(d), 'd MMM yyyy', { locale: localeId })}
            </span>
          ) : (
            '-'
          )
        },
      },
      {
        id: 'technician',
        header: 'Teknisi',
        cell: ({ row }) => (
          <span className="text-sm">{getLeadTechnicianName(row.original) ?? '-'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onRowClick(row.original.order_id)
                }}
              >
                Lihat Detail
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setBulkCancelOrderId(row.original.order_id)
                }}
                className="text-destructive"
              >
                Batalkan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [onRowClick]
  )

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
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">{selectedIds.length} order dipilih</p>
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

      <div className="rounded-xl border hidden md:block">
        <Table>
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
                onClick={() => onRowClick(row.original.order_id)}
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

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {table.getRowModel().rows.map((row) => {
          const order = row.original
          const dateStr = order.scheduled_visit_date ?? order.req_visit_date
          const tech = getLeadTechnicianName(order)
          const serviceType = getPrimaryServiceType(order)
          const isSelected = row.getIsSelected()
          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(order.order_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRowClick(order.order_id)
                }
              }}
              className="rounded-xl border bg-card p-3 shadow-sm active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => row.toggleSelected(!!v)}
                      aria-label="Pilih order"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {order.customers?.customer_name ?? 'Customer'}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">
                      {order.order_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusBadge status={order.status} size="sm" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onRowClick(order.order_id)
                        }}
                      >
                        Lihat Detail
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setBulkCancelOrderId(order.order_id)
                        }}
                        className="text-destructive"
                      >
                        Batalkan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {serviceType && <ServiceTypeBadge serviceType={serviceType} size="sm" />}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {dateStr && (
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3 w-3 shrink-0" />
                    <span>
                      {format(new Date(dateStr), 'd MMM yyyy', { locale: localeId })}
                    </span>
                  </div>
                )}
                {tech && (
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{tech}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
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
