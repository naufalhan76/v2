'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
  return ORDER_STATUS_SEQUENCE.flatMap((status) => {
    const item = breakdown.find((b) => b.status === status)
    const value = item?.count ?? 0
    return value > 0 ? [{
      name: getStatusLabel(status),
      value,
      color: STATUS_COLORS[status],
      status,
    }] : []
  })
}

export function StatusBreakdownDonut({
  startDate,
  endDate,
  index = 0,
}: {
  startDate: string
  endDate: string
  index?: number
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
      <Card className="border-hairline shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-canvas-soft rounded" />
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
            <PieChartIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Distribusi Status Order
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-ink-mute">
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
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={200}
                    animationEasing="ease-out"
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
                      border: '1px solid hsl(var(--hairline))',
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
                    wrapperStyle={{ fontSize: '14px', color: 'hsl(var(--foreground))', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
