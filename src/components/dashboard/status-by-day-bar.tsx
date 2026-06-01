'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export interface DailyStatusData {
  date: string
  formattedDate: string
  completed: number
  in_progress: number
  pending: number
  cancelled: number
}

export function StatusByDayBar({
  data,
  loading = false,
}: {
  data: DailyStatusData[]
  loading?: boolean
}) {
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
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">
            Status per Hari
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
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Bar
                  dataKey="completed"
                  name="Selesai"
                  stackId="status"
                  fill="hsl(var(--status-completed))"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="in_progress"
                  name="Sedang Dikerjakan"
                  stackId="status"
                  fill="hsl(var(--status-in-progress))"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  name="Menunggu"
                  stackId="status"
                  fill="hsl(var(--status-pending))"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="cancelled"
                  name="Dibatalkan"
                  stackId="status"
                  fill="hsl(var(--status-cancelled))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
