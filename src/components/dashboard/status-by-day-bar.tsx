'use client'

import { motion } from 'framer-motion'
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
  index = 0,
}: {
  data: DailyStatusData[]
  loading?: boolean
  index?: number
}) {
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
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-2xl tracking-tight text-foreground">
              Status per Hari
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-lg text-ink-mute">
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
                    stroke="hsl(var(--hairline))"
                  />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fontSize: 11, fill: 'hsl(var(--ink-mute))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--hairline))' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--ink-mute))' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--hairline))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '14px', color: 'hsl(var(--foreground))', paddingTop: '8px' }}
                  />
                  <Bar
                    dataKey="completed"
                    name="Selesai"
                    stackId="status"
                    fill="hsl(var(--status-completed))"
                    radius={[0, 0, 4, 4]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={200}
                  />
                  <Bar
                    dataKey="in_progress"
                    name="Sedang Dikerjakan"
                    stackId="status"
                    fill="hsl(var(--status-in-progress))"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={350}
                  />
                  <Bar
                    dataKey="pending"
                    name="Menunggu"
                    stackId="status"
                    fill="hsl(var(--status-pending))"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={500}
                  />
                  <Bar
                    dataKey="cancelled"
                    name="Dibatalkan"
                    stackId="status"
                    fill="hsl(var(--status-cancelled))"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={650}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
