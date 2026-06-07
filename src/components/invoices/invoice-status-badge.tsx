'use client'

import { AlertTriangle, CheckCheck, FileEdit, Send, Wallet, XCircle, type LucideIcon } from 'lucide-react'
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

const STATUS_ICONS: Record<InvoiceStatus, LucideIcon> = {
  DRAFT: FileEdit,
  SENT: Send,
  PARTIAL_PAID: Wallet,
  PAID: CheckCheck,
  OVERDUE: AlertTriangle,
  CANCELLED: XCircle,
}

/**
 * Displays an invoice status as a colored badge with icon.
 * Falls back to DRAFT styling for unknown values.
 */
export function InvoiceStatusBadge({ status, size = 'default', className }: InvoiceStatusBadgeProps) {
  const normalizedStatus = (status?.toUpperCase() ?? 'DRAFT') as InvoiceStatus
  const colors = INVOICE_STATUS_COLORS[normalizedStatus] ?? INVOICE_STATUS_COLORS.DRAFT
  const label = INVOICE_STATUS_LABELS[normalizedStatus] ?? status ?? 'Draft'
  const Icon = STATUS_ICONS[normalizedStatus]

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium rounded-md px-2.5 py-0.5 gap-1',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {Icon && <Icon className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
      {label}
    </Badge>
  )
}
