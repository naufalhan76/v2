'use client'

import { forwardRef } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Calendar, MapPin, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/orders/status-badge'
import { ServiceTypeBadge } from '@/components/orders/service-type-badge'
import {
  type OrderForDisplay,
  getUrgencyLevel,
  URGENCY_BORDER,
  getLeadTechnicianName,
  getPrimaryServiceType,
  getPrimaryLocation,
} from '@/lib/order-utils'

interface OrderCardProps {
  order: OrderForDisplay
  onClick?: (orderId: string) => void
  isDragging?: boolean
  /** When true, hide status badge (e.g. inside a column already labeled by status) */
  hideStatusBadge?: boolean
  className?: string
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelectToggle?: (orderId: string) => void
  isFocused?: boolean
}

/**
 * Compact card for the Kanban board.
 * - Urgency border on the left
 * - Customer name prominent
 * - Service type + scheduled date + technician name
 * - Click opens the OrderDetailPanel
 */
export const OrderCard = forwardRef<HTMLDivElement, OrderCardProps>(function OrderCard(
  { order, onClick, isDragging, hideStatusBadge, className, isSelectionMode, isSelected, onSelectToggle, isFocused, ...rest },
  ref
) {
  const urgency = getUrgencyLevel(order)
  const tech = getLeadTechnicianName(order)
  const serviceType = getPrimaryServiceType(order)
  const location = getPrimaryLocation(order)
  const dateStr = order.scheduled_visit_date ?? order.req_visit_date

  function handleClick() {
    if (isSelectionMode) {
      onSelectToggle?.(order.order_id)
    } else {
      onClick?.(order.order_id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation()
    onSelectToggle?.(order.order_id)
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-md bg-background border border-hairline p-3 shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-hairline transition-shadow',
        URGENCY_BORDER[urgency],
        isDragging && 'opacity-50 ring-2 ring-primary',
        isSelectionMode && isSelected && 'ring-2 ring-primary bg-canvas-soft',
        isFocused && 'ring-2 ring-primary/70',
        className
      )}
      {...rest}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          {isSelectionMode && (
            <div className="mt-0.5 shrink-0" onClick={handleCheckboxClick}>
              <Checkbox
                checked={isSelected}
                aria-label={`Pilih order ${order.order_id}`}
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground truncate">
              {order.customers?.customer_name ?? 'Customer'}
            </p>
            <p className="text-base text-ink-mute truncate">{order.order_id}</p>
          </div>
        </div>
        {!hideStatusBadge && <StatusBadge status={order.status} size="sm" />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {serviceType && <ServiceTypeBadge serviceType={serviceType} size="sm" />}
      </div>

      <div className="space-y-1 text-base text-ink-mute">
        {dateStr && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(dateStr), 'd MMM yyyy', { locale: localeId })}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {tech && (
          <div className="flex items-center gap-1.5">
            <UserIcon className="h-3 w-3" />
            <span className="truncate">{tech}</span>
          </div>
        )}
      </div>
    </div>
  )
})
