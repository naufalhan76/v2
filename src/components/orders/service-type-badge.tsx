'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  SERVICE_TYPE_COLORS,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from '@/lib/status-colors'

interface ServiceTypeBadgeProps {
  /** Service type value (e.g., 'CLEANING', 'REPAIR') */
  serviceType: string | null | undefined
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

/**
 * Displays a service type as a colored badge.
 * Falls back to neutral styling for unknown service types.
 */
export function ServiceTypeBadge({ serviceType, size = 'default', className }: ServiceTypeBadgeProps) {
  const normalized = (serviceType?.toUpperCase() ?? '') as ServiceType
  const colors = SERVICE_TYPE_COLORS[normalized] ?? {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: '',
  }
  const label = SERVICE_TYPE_LABELS[normalized] ?? serviceType ?? 'Unknown'

  return (
    <Badge
      className={cn(
        colors.bg,
        colors.text,
        'font-medium border-0 rounded-full',
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        className
      )}
    >
      {label}
    </Badge>
  )
}
