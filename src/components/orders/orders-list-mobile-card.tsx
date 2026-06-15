'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Calendar as CalendarIcon, MoreHorizontal, User as UserIcon } from 'lucide-react'
import type { Row } from '@tanstack/react-table'
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
  getLeadTechnicianName,
  getPrimaryServiceType,
  type OrderForDisplay,
} from '@/lib/order-utils'

interface OrdersListMobileCardProps {
  row: Row<OrderForDisplay>
  onRowClick: (orderId: string) => void
  onCancel: (orderId: string) => void
}

export function OrdersListMobileCard({ row, onRowClick, onCancel }: OrdersListMobileCardProps) {
  const order = row.original
  const dateStr = order.scheduled_visit_date ?? order.req_visit_date
  const tech = getLeadTechnicianName(order)
  const serviceType = getPrimaryServiceType(order)
  const isSelected = row.getIsSelected()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRowClick(order.order_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick(order.order_id)
        }
      }}
      className="rounded-lg border border-border bg-background p-3 shadow-sm active:bg-surface-muted transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox checked={isSelected} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Pilih order" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-foreground truncate">{order.customers?.customer_name ?? 'Customer'}</p>
            <p className="font-mono text-xs text-muted-foreground truncate">{order.order_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={order.status} size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(order.order_id) }}>Lihat Detail</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel(order.order_id) }} className="text-destructive">Batalkan</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {serviceType && <ServiceTypeBadge serviceType={serviceType} size="sm" />}
      </div>

      <div className="space-y-1 text-base text-muted-foreground">
        {dateStr && (
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3 w-3 shrink-0" />
            <span>{format(new Date(dateStr), 'd MMM yyyy', { locale: localeId })}</span>
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
}
