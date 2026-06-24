'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import {
  type OrderForDisplay,
  getLeadTechnicianName,
  getPrimaryServiceType,
} from '@/lib/order-utils'

export function createOrdersListColumns(
  onRowClick: (orderId: string) => void,
  setBulkCancelOrderId: Dispatch<SetStateAction<string | null>>,
): ColumnDef<OrderForDisplay>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
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
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-3">
          Order ID <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.order_id}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => <span className="text-sm">{row.original.customers?.customer_name ?? '-'}</span>,
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
        const serviceType = getPrimaryServiceType(row.original)
        return serviceType ? <ServiceTypeBadge serviceType={serviceType} size="sm" /> : '-'
      },
    },
    {
      accessorKey: 'scheduled_visit_date',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-3">
          Jadwal <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const dateValue = row.original.scheduled_visit_date ?? row.original.req_visit_date
        return dateValue ? <span className="text-xs">{format(new Date(dateValue), 'd MMM yyyy', { locale: localeId })}</span> : '-'
      },
    },
    {
      id: 'technician',
      header: 'Teknisi',
      cell: ({ row }) => <span className="text-sm">{getLeadTechnicianName(row.original) ?? '-'}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(row.original.order_id) }} className="text-foreground">
              Lihat Detail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setBulkCancelOrderId(row.original.order_id) }} className="text-destructive">
              Batalkan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ]
}
