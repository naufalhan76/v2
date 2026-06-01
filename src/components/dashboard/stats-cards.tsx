'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Delta } from '@/components/ui/delta'
import { getDashboardKpis } from '@/lib/actions/dashboard'
import { adaptKpis, type DashboardKPI } from '@/lib/dashboard-data'
import { formatRupiah } from '@/lib/utils'
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
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-3 h-4 w-24 rounded bg-muted" />
              <div className="mb-2 h-8 w-32 rounded bg-muted" />
              <div className="h-5 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="group border-0 shadow-sm transition-all hover:shadow-md"
        >
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </div>
            <div className="mb-2 text-2xl font-bold tracking-tight text-foreground">
              {kpi.label === 'Total Revenue'
                ? formatRupiah(kpi.value)
                : kpi.value.toLocaleString('id-ID')}
            </div>
            <Delta value={kpi.delta} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
