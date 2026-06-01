'use client'

import { useEffect, useState } from 'react'
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
}: {
  startDate: string
  endDate: string
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
      <Card className="border-0 shadow-sm bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">
            Pendapatan vs Order Harian
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
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
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return [formatRupiah(value), 'Pendapatan Aktual']
                  if (name === 'orders') return [value, 'Jumlah Order']
                  return [value, name]
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value: string) => {
                  if (value === 'revenue') return 'Pendapatan Aktual'
                  if (value === 'orders') return 'Jumlah Order'
                  return value
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="orders"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(142.1 76.2% 36.3%)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
