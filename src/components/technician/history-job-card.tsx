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
      href={`/technician/job/${job.order_id}`}
      className="block rounded-[32px] border border-gray-100 bg-white p-6 shadow dark:bg-[#1a1833] dark:border-gray-700 transition-colors active:bg-gray-50 hover:bg-gray-50 dark:active:bg-[#252243] dark:hover:bg-[#252243]"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-mono font-medium text-gray-500 dark:text-[#a5a3b5] bg-gray-100 dark:bg-[#252243] px-2 py-1 rounded">{job.order_id}</span>
        {job.status === 'CANCELLED' ? (
          <span className="bg-red-50 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-800">Dibatalkan</span>
        ) : (
          <span className="bg-green-50 text-green-600 text-xs font-bold px-2.5 py-1 rounded-full border border-green-100 dark:bg-green-950 dark:text-green-400 dark:border-green-800">Selesai</span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="font-bold text-xl text-[#1e1b4b] dark:text-white truncate flex-1">{customerName}</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Wrench className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>{serviceType}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>{scheduledDate}</span>
        </div>
        {actualPrice > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Banknote className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="font-medium text-[#1e1b4b] dark:text-white">{formatCurrency(actualPrice)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
