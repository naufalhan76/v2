'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getChartData } from '@/lib/actions/dashboard'
import { adaptChartData, type OrderVolumeDataPoint } from '@/lib/dashboard-data'
import { formatRupiah } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

type Period = 7 | 30 | 60

function getDateRange(period: Period): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - period)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export function OrdersRevenueAreaChart() {
  const [period, setPeriod] = useState<Period>(30)
  const [data, setData] = useState<OrderVolumeDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period) => {
    const { startDate, endDate } = getDateRange(p)
    setLoading(true)
    const res = await getChartData(startDate, endDate)
    setData(adaptChartData(res))
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchData(period).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [period, fetchData])

  if (loading) {
    return (
      <Card className="animate-pulse border-hairline bg-background shadow-none">
        <CardHeader className="pb-2">
          <div className="h-5 w-56 rounded bg-canvas-soft" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] rounded bg-canvas-soft" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-hairline bg-background shadow-none transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-2xl tracking-tight text-foreground">
            Orders &amp; Revenue Overview
          </CardTitle>
        </div>
        <Select
          value={String(period)}
          onValueChange={(v) => setPeriod(Number(v) as Period)}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7" className="text-xs">
              Last 7 days
            </SelectItem>
            <SelectItem value="30" className="text-xs">
              Last 30 days
            </SelectItem>
            <SelectItem value="60" className="text-xs">
              Last 60 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={(v: number) => `Rp${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--hairline))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return [formatRupiah(value), 'Revenue']
                  if (name === 'orders') return [value, 'Orders']
                  return [value, name]
                }}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="orders"
                stroke="hsl(var(--chart-1))"
                fill="url(#gradientOrders)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-1))' }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-2))"
                fill="url(#gradientRevenue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-2))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
