'use client'

import Link from 'next/link'
import { Clock, MapPin, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/orders/status-badge'
import type { OrderStatus } from '@/lib/order-status'

export interface TodayJob {
  order_id: string
  status: string
  canonical_status: OrderStatus
  scheduled_visit_date: string
  customers: {
    customer_name: string
    primary_contact_person: string | null
    phone_number: string | null
  } | null
  order_items: Array<{
    service_type: string
    locations: {
      full_address: string
      city: string | null
    } | null
  }>
}

interface TodayJobCardProps {
  job: TodayJob
}

export function TodayJobCard({ job }: TodayJobCardProps) {
  const isActive = job.canonical_status === 'EN_ROUTE' || job.canonical_status === 'IN_PROGRESS'
  const scheduledTime = new Date(job.scheduled_visit_date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const serviceType = job.order_items?.[0]?.service_type ?? 'Service AC'
  const address = job.order_items?.[0]?.locations?.full_address ?? '-'
  const customerName = job.customers?.customer_name ?? 'Customer'

  return (
    <Link
      href={`/technician/job/${encodeURIComponent(job.order_id)}`}
      className={cn(
        'block rounded-xl border p-4 transition-colors active:bg-accent/50',
        isActive
          ? 'border-primary/50 bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-accent/30'
      )}
    >
      {/* Top row: time + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{scheduledTime}</span>
        </div>
        <StatusBadge status={job.status} size="sm" />
      </div>

      {/* Customer name */}
      <h3 className="font-medium text-base mb-1 truncate">{customerName}</h3>

      {/* Service type */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
        <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{serviceType}</span>
      </div>

      {/* Address */}
      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span className="line-clamp-2">{address}</span>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          {job.canonical_status === 'EN_ROUTE' ? 'Dalam Perjalanan' : 'Sedang Dikerjakan'}
        </div>
      )}
    </Link>
  )
}
