'use client'

import Link from 'next/link'
import { Calendar, Wrench, Banknote } from 'lucide-react'
import { StatusBadge } from '@/components/orders/status-badge'

interface HistoryJob {
  order_id: string
  status: string
  scheduled_visit_date: string
  customers: {
    customer_name: string
  } | null
  order_items: Array<{
    service_type: string
    estimated_price: number | null
  }>
  service_reports: Array<{
    actual_total_price: number | null
    submitted_at: string | null
  }> | null
}

interface HistoryJobCardProps {
  job: HistoryJob
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function HistoryJobCard({ job }: HistoryJobCardProps) {
  const customerName = job.customers?.customer_name ?? 'Customer'
  const serviceType = job.order_items?.[0]?.service_type ?? 'Service AC'
  const report = job.service_reports?.[0]
  const actualPrice = report?.actual_total_price ?? job.order_items?.[0]?.estimated_price ?? 0
  const scheduledDate = new Date(job.scheduled_visit_date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      href={`/technician/job/${encodeURIComponent(job.order_id)}`}
      className="block rounded-xl border bg-card p-4 transition-colors active:bg-accent/50 hover:bg-accent/30"
    >
      {/* Top row: customer + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm truncate flex-1">{customerName}</h3>
        <StatusBadge status={job.status} size="sm" />
      </div>

      {/* Details */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{serviceType}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{scheduledDate}</span>
        </div>
        {actualPrice > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="font-medium text-foreground">{formatCurrency(actualPrice)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
