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
  const serviceTypes = (job.order_items ?? [])
    .map((item) => item.service_type)
    .filter((t): t is string => Boolean(t))
  const serviceType = serviceTypes.length > 0
    ? [...new Set(serviceTypes)].join(' · ')
    : 'Service AC'
  const report = job.service_reports?.[0]
  const estimatedTotal = (job.order_items ?? []).reduce(
    (sum, item) => sum + (item.estimated_price ?? 0),
    0,
  )
  const actualPrice = report?.actual_total_price ?? estimatedTotal
  const scheduledDate = new Date(job.scheduled_visit_date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      href={`/technician/job/${job.order_id}`}
      className="block rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border transition-colors active:bg-muted hover:bg-muted dark:active:bg-surface dark:hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-mono font-medium text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-surface px-2 py-1 rounded">{job.order_id}</span>
        {job.status === 'CANCELLED' ? (
          <span className="bg-status-cancelled-bg text-status-cancelled text-xs font-bold px-2.5 py-1 rounded-full border border-status-cancelled/30 dark:bg-status-cancelled-bg dark:text-status-cancelled dark:border-status-cancelled">Dibatalkan</span>
        ) : (
          <span className="bg-status-completed-bg text-status-completed text-xs font-bold px-2.5 py-1 rounded-full border border-status-completed/30 dark:bg-status-completed-bg dark:text-status-completed dark:border-status-completed">Selesai</span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="font-bold text-xl text-primary dark:text-foreground truncate flex-1">{customerName}</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground">
          <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{serviceType}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{scheduledDate}</span>
        </div>
        {actualPrice > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground">
            <Banknote className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-primary dark:text-foreground">{formatCurrency(actualPrice)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
