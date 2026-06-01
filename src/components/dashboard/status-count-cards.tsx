'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { getStatusBreakdown } from '@/lib/actions/dashboard'
import { ORDER_STATUS_SEQUENCE, getStatusLabel, ORDER_STATUS_COLORS } from '@/lib/order-status'
import { cn } from '@/lib/utils'
import { ClipboardList } from 'lucide-react'

export function StatusCountCards({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStatusBreakdown(startDate, endDate).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setCounts(res.data as Record<string, number>)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  const total = Object.values(counts).reduce((sum, v) => sum + v, 0)

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-muted rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {ORDER_STATUS_SEQUENCE.map((status, index) => {
        const count = counts[status] || 0
        const colors = ORDER_STATUS_COLORS[status]
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <Card
            key={status}
            className={cn(
              'border-0 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              'bg-background'
            )}
            style={{
              animationDelay: `${index * 60}ms`,
            }}
          >
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div
                className={cn('w-2 h-2 rounded-full', colors.bg)}
              />
              <span className={cn('text-lg font-bold leading-none', colors.text)}>
                {count}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">
                {getStatusLabel(status)}
              </span>
              {total > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                  {pct}%
                </span>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
