'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Delta } from '@/components/ui/delta'
import { getDashboardKpis } from '@/lib/actions/dashboard'
import { adaptKpis, type DashboardKPI } from '@/lib/dashboard-data'
import { cn, formatRupiah } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

function useCountUp(end: number, enabled: boolean, duration: number = 1000): number {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    setValue(0)
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [end, enabled, duration])

  return value
}

function AnimatedKpiValue({
  kpi,
  isPrimary,
}: {
  kpi: DashboardKPI
  isPrimary: boolean
}) {
  // Only animate once on initial mount (not on every re-render)
  const [hasAnimated, setHasAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHasAnimated(true), 300)
    return () => clearTimeout(t)
  }, [])

  const animatedValue = useCountUp(kpi.value, hasAnimated)
  const displayValue =
    kpi.label === 'Total Revenue'
      ? formatRupiah(hasAnimated ? animatedValue : 0)
      : hasAnimated
        ? animatedValue.toLocaleString('id-ID')
        : '0'

  return (
    <div
      className={cn(
        'mb-2 tracking-tight tabular-nums',
        isPrimary
          ? 'text-xl font-[540] leading-tight'
          : 'text-lg font-[460] leading-tight'
      )}
    >
      {displayValue}
    </div>
  )
}

export function StatsCards({ startDate, endDate }: { startDate?: string; endDate?: string } = {}) {
  const [kpis, setKpis] = useState<DashboardKPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDashboardKpis(startDate, endDate).then((res) => {
      if (cancelled) return
      setKpis(adaptKpis(res))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse shadow-none">
            <CardContent className="p-6">
              <div className="mb-3 h-4 w-24 rounded bg-surface-muted" />
              <div className="mb-2 h-8 w-32 rounded bg-surface-muted" />
              <div className="h-5 w-20 rounded bg-surface-muted" />
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
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              delay: index * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Card
              className={cn(
                'group shadow-none transition-shadow hover:shadow-md',
                isPrimary
                  ? 'border-0 bg-primary text-primary-foreground'
                  : 'border-border bg-surface-muted'
              )}
            >
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      isPrimary
                        ? 'text-xl font-[540] text-primary-foreground/80'
                        : 'text-sm font-[460] text-muted-foreground'
                    )}
                  >
                    {kpi.label}
                  </span>
                  <ArrowRight
                    className={cn(
                      'h-3.5 w-3.5 transition-all group-hover:translate-x-0.5',
                      isPrimary
                        ? 'text-primary-foreground/30 group-hover:text-primary-foreground/70'
                        : 'text-muted-foreground group-hover:text-muted-foreground'
                    )}
                  />
                </div>
                <AnimatedKpiValue kpi={kpi} isPrimary={isPrimary} />
                <Delta value={kpi.delta} />
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
