'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTopTechnicians } from '@/lib/actions/dashboard'
import { Medal, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopTech {
  id: string
  name: string
  completed: number
  total: number
}

export function TopTechniciansTable({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<TopTech[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTopTechnicians(startDate, endDate, 10).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setData(res.data as TopTech[])
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
          <div className="h-[200px] bg-surface-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-none bg-background transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-status-pending" />
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Top 10 Teknisi
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <Wrench className="h-6 w-6 text-muted-foreground" />
            <span>Belum ada data teknisi</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">
                    #
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nama
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                    Selesai
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                    Total
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right w-24">
                    Rate
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tech, index) => {
                  const rate = tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0
                  return (
                    <TableRow
                      key={tech.id}
                      className={cn(
                        'border-0 transition-colors hover:bg-surface-muted',
                        index < 3 && 'bg-surface-muted'
                      )}
                    >
                      <TableCell className="text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-sm">{tech.name}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold text-status-completed">
                        {tech.completed}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {tech.total}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'inline-block text-xs font-bold px-2 py-0.5 rounded-full',
                            rate >= 80
                              ? 'bg-status-completed/12 text-status-completed'
                              : rate >= 50
                                ? 'bg-status-pending/12 text-status-pending'
                                : 'bg-status-cancelled/12 text-status-cancelled'
                          )}
                        >
                          {rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
