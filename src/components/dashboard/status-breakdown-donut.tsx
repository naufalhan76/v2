'use client'

import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStatusBreakdown } from '@/lib/actions/dashboard'
import { adaptStatusBreakdown, StatusBreakdownItem } from '@/lib/dashboard-data'
import { getStatusLabel, ORDER_STATUS_SEQUENCE } from '@/lib/order-status'
import { PieChartIcon } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'hsl(var(--status-pending))',
  ASSIGNED: 'hsl(var(--status-assigned))',
  EN_ROUTE: 'hsl(var(--status-en-route))',
  IN_PROGRESS: 'hsl(var(--status-in-progress))',
  COMPLETED: 'hsl(var(--status-completed))',
  INVOICED: 'hsl(var(--status-invoiced))',
  PAID: 'hsl(var(--status-paid))',
  CANCELLED: 'hsl(var(--status-cancelled))',
}

interface DonutSlice {
  name: string
  value: number
  color: string
  status: string
}

function buildDonutData(breakdown: StatusBreakdownItem[]): DonutSlice[] {
  return ORDER_STATUS_SEQUENCE.map((status) => {
    const item = breakdown.find((b) => b.status === status)
    return {
      name: getStatusLabel(status),
      value: item?.count ?? 0,
      color: STATUS_COLORS[status],
      status,
    }
  }).filter((d) => d.value > 0)
}

export function StatusBreakdownDonut({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<DonutSlice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStatusBreakdown(startDate, endDate).then((res) => {
      if (cancelled) return
      const breakdown = adaptStatusBreakdown(res)
      setData(buildDonutData(breakdown))
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
          <div className="h-[300px] bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">
            Distribusi Status Order
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
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
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="inside"
                    stroke="none"
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      fill: '#ffffff',
                    }}
                    formatter={(_value: number, _name: string, props: { payload?: DonutSlice }) => {
                      const payload = props?.payload
                      if (!payload) return ''
                      return `${payload.name}: ${payload.value}`
                    }}
                  />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, _name: string, props: { payload?: DonutSlice }) => {
                    const payload = props?.payload
                    return [value, payload?.name ?? '']
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
