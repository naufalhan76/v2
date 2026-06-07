'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-browser'
import { Briefcase, Clock, Sparkles } from 'lucide-react'
import { SyncStatus } from '@/components/technician/sync-status'
import type { OrderStatus } from '@/lib/order-status'

interface TodayJob {
  order_id: string
  canonical_status: OrderStatus
}

export function HomeHeader() {
  const [greeting, setGreeting] = useState('')
  const [longDate, setLongDate] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 11) setGreeting('Selamat pagi')
    else if (hour < 15) setGreeting('Selamat siang')
    else if (hour < 18) setGreeting('Selamat sore')
    else setGreeting('Selamat malam')

    setLongDate(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [])

  const { data: profile } = useQuery({
    queryKey: ['technician', 'profile', 'header'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('technicians')
        .select('technician_name')
        .eq('auth_user_id', user.id)
        .single()
      if (error) return null
      return data
    },
    staleTime: 5 * 60_000,
  })

  // Share cache with TodayJobsList via identical queryKey
  const { data: jobs } = useQuery<unknown, unknown, TodayJob[]>({
    queryKey: ['technician', 'jobs', 'today'],
    queryFn: async () => {
      const res = await fetch('/api/technician/jobs/today', { credentials: 'include' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Gagal memuat data')
      return json.data
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const activeCount =
    jobs?.filter((j) => j.canonical_status === 'EN_ROUTE' || j.canonical_status === 'IN_PROGRESS')
      .length ?? 0
  const pendingCount =
    jobs?.filter((j) => j.canonical_status === 'ASSIGNED' || j.canonical_status === 'PENDING')
      .length ?? 0
  const completedCount =
    jobs?.filter(
      (j) =>
        j.canonical_status === 'COMPLETED' ||
        j.canonical_status === 'INVOICED' ||
        j.canonical_status === 'PAID'
    ).length ?? 0

  const firstName = profile?.technician_name?.split(' ')[0] || ''
  const hasJobs = (jobs?.length ?? 0) > 0

  return (
    <div className="space-y-3" data-testid="technician-home-header">
      {/* Greeting */}
      <div className="flex items-start gap-3">
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl sm:text-4xl font-[540] tracking-tight">
            {greeting || '...'}
            {firstName ? <span className="text-primary-foreground/80">, {firstName}</span> : null}
            <span className="text-primary-foreground/60">.</span>
          </h1>
          <p className="text-lg text-ink-mute capitalize tabular-nums">
            {longDate}
          </p>
        </div>
        <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
      </div>

      {/* Quick stats */}
      {hasJobs && (
        <div
          className="grid grid-cols-3 gap-2"
          role="list"
          aria-label="Ringkasan pekerjaan"
        >
          <StatChip
            icon={<Briefcase className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Aktif"
            value={activeCount}
            tone="primary"
          />
          <StatChip
            icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Mendatang"
            value={pendingCount}
            tone="muted"
          />
          <StatChip
            icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Selesai"
            value={completedCount}
            tone="success"
          />
        </div>
      )}
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'primary' | 'muted' | 'success'
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary bg-primary text-primary-foreground'
      : tone === 'success'
        ? 'border-status-completed bg-status-completed text-white'
        : 'border-hairline bg-canvas-soft text-foreground'

  return (
    <div
      role="listitem"
      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${toneClass}`}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
    </div>
  )
}
