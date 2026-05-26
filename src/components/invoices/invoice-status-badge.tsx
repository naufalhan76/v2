'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from '@/lib/status-colors'

interface InvoiceStatusBadgeProps {
  /** Invoice status value */
  status: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

/**
 * Displays an invoice status as a colored badge.
 * Falls back to DRAFT styling for unknown values.
 */
export function InvoiceStatusBadge({ status, size = 'default', className }: InvoiceStatusBadgeProps) {
  const normalizedStatus = (status?.toUpperCase() ?? 'DRAFT') as InvoiceStatus
  const colors = INVOICE_STATUS_COLORS[normalizedStatus] ?? INVOICE_STATUS_COLORS.DRAFT
  const label = INVOICE_STATUS_LABELS[normalizedStatus] ?? status ?? 'Draft'

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
