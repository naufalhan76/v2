'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusIndicator } from '@/components/ui/indicator'
import { getRecentOrders } from '@/lib/actions/dashboard'
import { adaptRecentOrders, type RecentOrderItem } from '@/lib/dashboard-data'
import { getStatusLabel, toCanonical, type OrderStatus } from '@/lib/order-status'
import { cn } from '@/lib/utils'
import {
  Activity,
  Clock,
  Truck,
  UserCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const ATTENTION_STATUSES: OrderStatus[] = [
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
]

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  PENDING: Clock,
  ASSIGNED: UserCheck,
  EN_ROUTE: Truck,
  IN_PROGRESS: Wrench,
  COMPLETED: Wrench,
  INVOICED: Wrench,
  PAID: Wrench,
  CANCELLED: Wrench,
}

const STATUS_INDICATOR_COLOR: Record<
  OrderStatus,
  'emerald' | 'amber' | 'red' | 'blue'
> = {
  PENDING: 'amber',
  ASSIGNED: 'blue',
  EN_ROUTE: 'blue',
  IN_PROGRESS: 'blue',
  COMPLETED: 'emerald',
  INVOICED: 'emerald',
  PAID: 'emerald',
  CANCELLED: 'red',
}

const STATUS_ICON_TINT: Record<OrderStatus, string> = {
  PENDING: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40',
  ASSIGNED: 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/40',
  EN_ROUTE: 'text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/40',
  IN_PROGRESS: 'text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40',
  COMPLETED: 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-950/40',
  INVOICED: 'text-cyan-600 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-950/40',
  PAID: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40',
  CANCELLED: 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-950/40',
}

function formatTimestamp(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OrdersActivityFeed({ limit = 10 }: { limit?: number }) {
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

  const needsAttention = orders.filter((order) =>
    ATTENTION_STATUSES.includes(toCanonical(order.status))
  )

  if (loading) {
    return (
      <Card className="border-0 shadow-sm bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-44 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-36 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-semibold text-foreground">
          Perlu Perhatian
        </CardTitle>
      </CardHeader>
      <CardContent>
        {needsAttention.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <Activity className="h-6 w-6 text-muted-foreground/40" />
            <span>Tidak ada order yang perlu perhatian</span>
          </div>
        ) : (
          <ul className="space-y-1">
            {needsAttention.map((order) => {
              const canonical = toCanonical(order.status)
              const Icon = STATUS_ICONS[canonical]
              return (
                <li
                  key={order.order_id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      STATUS_ICON_TINT[canonical]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {order.customer_name}
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      <span className="text-muted-foreground font-normal">
                        {getStatusLabel(order.status)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTimestamp(order.created_at)}
                    </p>
                  </div>

                  <StatusIndicator
                    color={STATUS_INDICATOR_COLOR[canonical]}
                    pulse={canonical === 'PENDING'}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
