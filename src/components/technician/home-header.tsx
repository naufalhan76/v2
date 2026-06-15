'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-browser'
import { Briefcase, Clock, Sparkles, RefreshCw } from 'lucide-react'
import type { OrderStatus } from '@/lib/order-status'
import { useOnlineSync } from '@/hooks/use-online-sync'

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

  const { pending } = useOnlineSync()
  const syncPendingCount = pending.reports + pending.transitions + pending.photos

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
    <div className="bg-primary pt-12 pb-24 px-6 rounded-b-[80px] space-y-3 relative" data-testid="technician-home-header">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            {greeting || '...'}
            {firstName ? <span>, {firstName}</span> : null}
          </h1>
          <p className="text-sm text-muted-foreground leading-tight capitalize tabular-nums">
            {longDate}
          </p>
        </div>
        
        {/* Sync Badge overlay logic */}
        {(syncPendingCount > 0) && (
          <div className="bg-status-pending px-3 py-1.5 rounded-full text-white font-bold text-sm flex items-center gap-1.5 shrink-0 mt-0.5">
             <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
             {syncPendingCount}
          </div>
        )}
      </div>

      {/* Quick stats */}
      {hasJobs && (
        <div
          className="grid grid-cols-3 gap-3 -mt-24 absolute bottom-[-40px] left-6 right-6 z-10"
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
      ? 'bg-primary text-white'
      : 'bg-white text-primary shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] dark:bg-surface dark:text-foreground dark:shadow-none'

  return (
    <div
      role="listitem"
      className={`flex flex-col gap-1 rounded-2xl p-3 ${toneClass}`}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-none mt-1">{value}</div>
    </div>
  )
}
