'use client'

import { useQuery } from '@tanstack/react-query'
import { TodayJobCard, type TodayJob } from './today-job-card'
import { TodayJobsSkeleton } from './today-jobs-skeleton'
import { EmptyTodayJobs } from './empty-today-jobs'
import { AlertCircle, Briefcase, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/lib/order-status'
import { cn } from '@/lib/utils'

async function fetchTodayJobs() {
  const res = await fetch('/api/technician/jobs/today', {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error('Gagal memuat pekerjaan hari ini')
  }
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Gagal memuat data')
  }
  return json.data
}

type Group = {
  key: 'active' | 'pending' | 'completed'
  title: string
  icon: React.ComponentType<{ className?: string }>
  jobs: TodayJob[]
}

function groupJobs(jobs: TodayJob[]): Group[] {
  const active: TodayJob[] = []
  const pending: TodayJob[] = []
  const completed: TodayJob[] = []

  for (const job of jobs) {
    const s: OrderStatus = job.canonical_status
    if (s === 'EN_ROUTE' || s === 'IN_PROGRESS') active.push(job)
    else if (s === 'ASSIGNED' || s === 'PENDING') pending.push(job)
    else if (s === 'COMPLETED' || s === 'INVOICED' || s === 'PAID') completed.push(job)
  }

  const byTimeAsc = (a: TodayJob, b: TodayJob) =>
    new Date(a.scheduled_visit_date).getTime() - new Date(b.scheduled_visit_date).getTime()

  active.sort(byTimeAsc)
  pending.sort(byTimeAsc)
  completed.sort(byTimeAsc)

  const out: Group[] = []
  if (active.length > 0)
    out.push({ key: 'active', title: 'Aktif', icon: Briefcase, jobs: active })
  if (pending.length > 0)
    out.push({ key: 'pending', title: 'Mendatang', icon: Clock, jobs: pending })
  if (completed.length > 0)
    out.push({ key: 'completed', title: 'Selesai Hari Ini', icon: CheckCircle2, jobs: completed })
  return out
}

export function TodayJobsList() {
  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['technician', 'jobs', 'today'],
    queryFn: fetchTodayJobs,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <TodayJobsSkeleton />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-ink-mute mb-4">
          {error instanceof Error ? error.message : 'Terjadi kesalahan'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-11">
          <RefreshCw className="mr-2 h-4 w-4" />
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (!jobs || jobs.length === 0) {
    return <EmptyTodayJobs />
  }

  const groups = groupJobs(jobs as TodayJob[])

  return (
    <div className="space-y-5" data-testid="today-jobs-section">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`} className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2
              id={`group-${group.key}`}
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider',
                group.key === 'active' && 'text-primary',
                group.key === 'pending' && 'text-ink-mute',
                group.key === 'completed' && 'text-status-completed'
              )}
            >
              <group.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {group.title}
            </h2>
            <span className="text-[11px] font-medium tabular-nums text-ink-mute">
              {group.jobs.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {group.jobs.map((job) => (
              <TodayJobCard key={job.order_id} job={job} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
