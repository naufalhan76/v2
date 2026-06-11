'use client'

import { Banknote, Check, Clock, FileText, Truck, User, Wrench, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toCanonical, getStatusLabel, ORDER_STATUS_COLORS, type OrderStatus } from '@/lib/order-status'

interface StatusBadgeProps {
  /** Raw status from DB (legacy or canonical) */
  status: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

const STATUS_ICONS: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  ASSIGNED: User,
  EN_ROUTE: Truck,
  IN_PROGRESS: Wrench,
  COMPLETED: Check,
  INVOICED: FileText,
  PAID: Banknote,
  CANCELLED: XCircle,
}

/**
 * Displays an order status as a colored badge with icon.
 * Automatically maps legacy statuses to canonical ones.
 * Uses semantic color tokens from ORDER_STATUS_COLORS.
 */
export function StatusBadge({ status, size = 'default', className }: StatusBadgeProps) {
  const canonical: OrderStatus = toCanonical(status)
  const colors = ORDER_STATUS_COLORS[canonical]
  const label = getStatusLabel(status ?? '')
  const Icon = STATUS_ICONS[canonical]

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        size === 'sm' ? 'rounded-full text-[10px] px-2 py-1' : 'rounded-md px-2.5 py-0.5',
        className
      )}
    >
      {Icon && <Icon className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
      {label}
    </Badge>
  )
}
