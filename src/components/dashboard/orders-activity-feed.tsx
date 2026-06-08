'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  PENDING: 'text-status-pending bg-status-pending/12',
  ASSIGNED: 'text-status-assigned bg-status-assigned/12',
  EN_ROUTE: 'text-status-en-route bg-status-en-route/12',
  IN_PROGRESS: 'text-status-in-progress bg-status-in-progress/12',
  COMPLETED: 'text-status-completed bg-status-completed/12',
  INVOICED: 'text-status-invoiced bg-status-invoiced/12',
  PAID: 'text-status-paid bg-status-paid/12',
  CANCELLED: 'text-status-cancelled bg-status-cancelled/12',
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
      <Card className="border-hairline shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-44 bg-canvas-soft rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-canvas-soft rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-36 bg-canvas-soft rounded" />
                  <div className="h-3 w-24 bg-canvas-soft rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-hairline shadow-none bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <CardTitle className="text-2xl tracking-tight text-foreground">
          Perlu Perhatian
        </CardTitle>
      </CardHeader>
      <CardContent>
        {needsAttention.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-lg text-ink-mute gap-2">
            <Activity className="h-6 w-6 text-ink-faint" />
            <span>Tidak ada order yang perlu perhatian</span>
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence mode="popLayout">
              {needsAttention.map((order, index) => {
                const canonical = toCanonical(order.status)
                const Icon = STATUS_ICONS[canonical]
                return (
                  <motion.li
                    key={order.order_id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-canvas-soft"
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
                      <p className="text-lg truncate text-foreground">
                        {order.customer_name}
                        <span className="mx-1.5 text-ink-faint">·</span>
                        <span className="text-ink-mute">
                          {getStatusLabel(order.status)}
                        </span>
                      </p>
                      <p className="text-sm text-ink-faint tabular-nums">
                        {formatTimestamp(order.created_at)}
                      </p>
                    </div>

                    <StatusIndicator
                      color={STATUS_INDICATOR_COLOR[canonical]}
                      pulse={canonical === 'PENDING'}
                    />
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
