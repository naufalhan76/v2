'use client'

import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import { StatusBadge } from '@/components/orders/status-badge'
import { type OrderForDisplay, getLeadTechnicianName, getPrimaryServiceType } from '@/lib/order-utils'

interface OrderHistoryTableProps {
  orders: OrderForDisplay[]
  onRowClick: (orderId: string) => void
}

export function OrderHistoryTable({ orders, onRowClick }: OrderHistoryTableProps) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted dark:bg-surface-muted">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">ID Order</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Pelanggan</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Layanan</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Teknisi</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {orders.map((order) => (
              <tr key={order.order_id} onClick={() => onRowClick(order.order_id)} className="hover:bg-muted/40 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.order_id?.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-medium">
                  {typeof order.customers === 'object' && order.customers !== null
                    ? (order.customers as { customer_name?: string | null }).customer_name ?? '—' : '—'}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell"><ServiceTypeBadge serviceType={getPrimaryServiceType(order)} /></td>
                <td className="px-4 py-3"><StatusBadge status={order.status ?? ''} /></td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{getLeadTechnicianName(order)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground whitespace-nowrap">
                  {order.scheduled_visit_date ? format(new Date(order.scheduled_visit_date), 'dd MMM yyyy', { locale: localeId }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
