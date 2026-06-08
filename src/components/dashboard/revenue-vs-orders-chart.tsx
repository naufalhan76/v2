'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getChartData } from '@/lib/actions/dashboard'
import { formatRupiah } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface ChartPoint {
  date: string
  formattedDate: string
  orders: number
  revenue: number
  estimatedRevenue: number
}

export function RevenueVsOrdersChart({
  startDate,
  endDate,
  index = 0,
}: {
  startDate: string
  endDate: string
  index?: number
}) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getChartData(startDate, endDate).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setData(res.data as ChartPoint[])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  if (loading) {
    return (
      <Card className="border-hairline shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-48 bg-canvas-soft rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-canvas-soft rounded" />
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
      <Card className="border-hairline shadow-none bg-background transition-shadow hover:shadow-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Pendapatan vs Order Harian
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--hairline))" />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 11, fill: 'hsl(var(--ink-mute))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(var(--ink-mute))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--ink-mute))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `Rp${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--hairline))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [formatRupiah(value), 'Pendapatan Aktual']
                    if (name === 'orders') return [value, 'Jumlah Order']
                    return [value, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '14px', color: 'hsl(var(--foreground))' }}
                  formatter={(value: string) => {
                    if (value === 'revenue') return 'Pendapatan Aktual'
                    if (value === 'orders') return 'Jumlah Order'
                    return value
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="orders"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationBegin={200}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--status-completed))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationBegin={400}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
