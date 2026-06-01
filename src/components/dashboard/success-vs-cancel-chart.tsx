'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStatusBreakdown } from '@/lib/actions/dashboard'
import { getStatusLabel } from '@/lib/order-status'
import { CheckCircle2, XCircle } from 'lucide-react'

const COLORS = {
  completed: 'hsl(142.1 76.2% 36.3%)',
  cancelled: 'hsl(0 84.2% 60.2%)',
  other: 'hsl(var(--muted-foreground))',
}

export function SuccessVsCancelChart({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStatusBreakdown(startDate, endDate).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        const counts = res.data as Record<string, number>
        const completed =
          (counts['COMPLETED'] || 0) +
          (counts['INVOICED'] || 0) +
          (counts['PAID'] || 0)
        const cancelledCount = counts['CANCELLED'] || 0
        const other = Object.entries(counts).reduce((sum, [status, count]) => {
          if (!['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(status)) {
            return sum + (count || 0)
          }
          return sum
        }, 0)

        const chartData = []
        if (completed > 0) {
          chartData.push({ name: 'Selesai', value: completed, color: COLORS.completed })
        }
        if (cancelledCount > 0) {
          chartData.push({ name: 'Dibatalkan', value: cancelledCount, color: COLORS.cancelled })
        }
        if (other > 0) {
          chartData.push({ name: 'Berjalan', value: other, color: COLORS.other })
        }
        setData(chartData)
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
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[260px] bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <CardTitle className="text-sm font-semibold text-foreground">
            Selesai vs Dibatalkan
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
