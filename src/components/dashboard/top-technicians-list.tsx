'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusIndicator } from '@/components/ui/indicator'
import { getTopTechnicians } from '@/lib/actions/dashboard'
import { cn } from '@/lib/utils'
import { Medal, MoreHorizontal, User, Wrench } from 'lucide-react'

interface TopTech {
  id: string
  name: string
  completed: number
  total: number
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .flatMap((part) => (part[0] ? [part[0]] : []))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getRateColor(rate: number): 'emerald' | 'amber' | 'red' {
  if (rate >= 80) return 'emerald'
  if (rate >= 50) return 'amber'
  return 'red'
}

function getRateTextColor(rate: number): string {
  if (rate >= 80) return 'text-status-completed'
  if (rate >= 50) return 'text-status-pending'
  return 'text-status-cancelled'
}

function getRateBgColor(rate: number): string {
  if (rate >= 80) return 'bg-status-completed/12'
  if (rate >= 50) return 'bg-status-pending/12'
  return 'bg-status-cancelled/12'
}

export function TopTechniciansList({
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
      <Card className="border-hairline shadow-none bg-background animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-48 bg-canvas-soft rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 bg-canvas-soft rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-28 bg-canvas-soft rounded" />
                  <div className="h-3 w-20 bg-canvas-soft rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-hairline shadow-none bg-background transition-shadow hover:shadow-md">
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
          <div className="flex flex-col items-center justify-center py-10 text-sm text-ink-mute gap-2">
            <Wrench className="h-6 w-6 text-ink-faint" />
            <span>Belum ada data teknisi</span>
          </div>
        ) : (
          <ul className="space-y-1">
            {data.map((tech, index) => {
              const rate = tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0
              const rateColor = getRateColor(rate)
              return (
                <li
                  key={tech.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-canvas-soft',
                    index < 3 && 'bg-canvas-soft'
                  )}
                >
                  {/* Rank badge */}
                  <span className="w-5 text-center text-xs font-bold text-ink-mute tabular-nums">
                    {index + 1}
                  </span>

                  {/* Avatar */}
                  <Avatar className="h-9 w-9 border border-hairline">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(tech.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {tech.name}
                    </p>
                    <p className="text-sm text-ink-mute">
                      {tech.completed} selesai
                      <span className="mx-1">·</span>
                      {tech.total} total
                    </p>
                  </div>

                  {/* Rate badge */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <StatusIndicator color={rateColor} />
                      <span
                        className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full tabular-nums',
                          getRateTextColor(rate),
                          getRateBgColor(rate)
                        )}
                      >
                        {rate}%
                      </span>
                    </div>

                    {/* Dropdown menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-mute hover:text-foreground hover:bg-canvas-soft transition-colors"
                          aria-label={`Menu untuk ${tech.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem asChild>
                          <a
                            href={`/dashboard/manajemen/teknisi/${tech.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <User className="h-4 w-4" />
                            <span>Lihat Profil</span>
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
