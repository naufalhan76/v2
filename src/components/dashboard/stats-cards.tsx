'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Delta } from '@/components/ui/delta'
import { getDashboardKpis } from '@/lib/actions/dashboard'
import { adaptKpis, type DashboardKPI } from '@/lib/dashboard-data'
import { cn, formatRupiah } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

export function StatsCards() {
  const [kpis, setKpis] = useState<DashboardKPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDashboardKpis().then((res) => {
      if (cancelled) return
      setKpis(adaptKpis(res))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse shadow-none">
            <CardContent className="p-6">
              <div className="mb-3 h-4 w-24 rounded bg-canvas-soft" />
              <div className="mb-2 h-8 w-32 rounded bg-canvas-soft" />
              <div className="h-5 w-20 rounded bg-canvas-soft" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => {
        const isPrimary = index < 2
        return (
          <Card
            key={kpi.label}
            className={cn(
              'group shadow-none transition-shadow hover:shadow-md',
              isPrimary
                ? 'border-0 bg-primary text-primary-foreground'
                : 'border-hairline bg-canvas-soft'
            )}
          >
            <CardContent className="p-6">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    isPrimary
                      ? 'text-xl font-[540] text-primary-foreground/80'
                      : 'text-2xl font-[460] text-ink-mute'
                  )}
                >
                  {kpi.label}
                </span>
                <ArrowRight
                  className={cn(
                    'h-3.5 w-3.5 transition-all group-hover:translate-x-0.5',
                    isPrimary
                      ? 'text-primary-foreground/30 group-hover:text-primary-foreground/70'
                      : 'text-ink-faint group-hover:text-ink-mute'
                  )}
                />
              </div>
              <div
                className={cn(
                  'mb-2 tracking-tight',
                  isPrimary
                    ? 'text-[28px] font-[540] leading-tight'
                    : 'text-[22px] font-[460] leading-tight'
                )}
              >
                {kpi.label === 'Total Revenue'
                  ? formatRupiah(kpi.value)
                  : kpi.value.toLocaleString('id-ID')}
              </div>
              <Delta value={kpi.delta} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
