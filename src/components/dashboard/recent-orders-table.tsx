'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getRecentOrders } from '@/lib/actions/dashboard'
import { adaptRecentOrders, type RecentOrderItem } from '@/lib/dashboard-data'
import {
  getStatusLabel,
  toCanonical,
  ORDER_STATUS_COLORS,
} from '@/lib/order-status'
import { cn } from '@/lib/utils'
import { ArrowRight, ClipboardList, Inbox } from 'lucide-react'

function formatScheduledDate(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const canonical = toCanonical(status)
  const colors = ORDER_STATUS_COLORS[canonical]
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {getStatusLabel(status)}
    </Badge>
  )
}

export function RecentOrdersTable({ limit = 5 }: { limit?: number }) {
  const [orders, setOrders] = useState<RecentOrderItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getRecentOrders(limit).then((res) => {
      if (cancelled) return
      const normalized = {
        success: res.success,
        error: 'error' in res ? res.error : undefined,
        data: (res.data ?? []).map((row) => {
          const customers = Array.isArray(row.customers)
            ? row.customers[0] ?? null
            : row.customers
          return { ...row, customers }
        }),
      }
      setOrders(adaptRecentOrders(normalized))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [limit])

  if (loading) {
    return (
      <Card className="border-border shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-surface-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-32 bg-surface-muted rounded" />
                <div className="h-4 w-20 bg-surface-muted rounded" />
                <div className="h-4 w-24 bg-surface-muted rounded ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-none bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">
          Order Terbaru
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <span>Belum ada order</span>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <Table>
              <TableCaption className="sr-only">Recent orders</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Layanan</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="text-sm text-foreground">
                      {order.customer_name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.order_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatScheduledDate(order.order_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <div className="border-t px-4 py-3">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Lihat semua order
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}
