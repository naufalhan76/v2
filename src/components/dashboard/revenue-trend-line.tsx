'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getChartData } from '@/lib/actions/dashboard'
import { formatRupiah } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface RevenuePoint {
  date: string
  formattedDate: string
  revenue: number
}

export function RevenueTrendLine({
  startDate,
  endDate,
  index = 0,
}: {
  startDate: string
  endDate: string
  index?: number
}) {
  const [data, setData] = useState<RevenuePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getChartData(startDate, endDate).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        // Take last 7 days for a focused 7-day window
        const points = (res.data as Array<{
          date: string
          formattedDate: string
          revenue: number
        }>).slice(-7)
        setData(points)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  if (loading) {
    return (
      <Card className="border-border shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-48 bg-surface-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[240px] bg-surface-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Card className="border-border shadow-none bg-background transition-shadow hover:shadow-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-status-completed" />
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Tren Pendapatan (7 Hari)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
              Tidak ada data
            </div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 24, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `Rp${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(_value: number) => [formatRupiah(_value), 'Pendapatan']}
                    labelFormatter={(label: string) => `Tanggal: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--status-completed))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(var(--status-completed))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={200}
                  >
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      fontSize={10}
                      fill="hsl(var(--muted-foreground))"
                      formatter={(v: number) => `Rp${(v / 1000000).toFixed(1)}M`}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
