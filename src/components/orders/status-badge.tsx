'use client'

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

/**
 * Displays an order status as a colored badge.
 * Automatically maps legacy statuses to canonical ones.
 * Uses semantic color tokens from ORDER_STATUS_COLORS.
 */
export function StatusBadge({ status, size = 'default', className }: StatusBadgeProps) {
  const canonical: OrderStatus = toCanonical(status)
  const colors = ORDER_STATUS_COLORS[canonical]
  const label = getStatusLabel(status ?? '')

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  )
}
