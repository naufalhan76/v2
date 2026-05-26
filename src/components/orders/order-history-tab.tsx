'use client'

import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/orders/status-badge'
import { getOrderHistory } from '@/lib/actions/order-history'

interface OrderHistoryTabProps {
  orderId: string
}

export function OrderHistoryTab({ orderId }: OrderHistoryTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-history', orderId],
    queryFn: () => getOrderHistory(orderId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const transitions = data?.data ?? []

  if (transitions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada riwayat"
        description="Riwayat status akan muncul di sini setiap kali order berubah."
      />
    )
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {transitions.map((t) => (
        <li key={t.id} className="ml-4">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {t.from_status && <StatusBadge status={t.from_status} size="sm" />}
            <span className="text-xs text-muted-foreground">→</span>
            <StatusBadge status={t.to_status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(t.transition_date), 'd MMM yyyy, HH:mm', { locale: localeId })}
          </p>
          {t.notes && <p className="text-sm mt-1">{t.notes}</p>}
        </li>
      ))}
    </ol>
  )
}
