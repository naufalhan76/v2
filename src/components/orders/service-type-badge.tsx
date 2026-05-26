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
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  }
  const label = SERVICE_TYPE_LABELS[normalized] ?? serviceType ?? 'Unknown'

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
