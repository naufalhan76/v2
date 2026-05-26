'use client'

import { useQuery } from '@tanstack/react-query'
import { TodayJobCard, type TodayJob } from './today-job-card'
import { TodayJobsSkeleton } from './today-jobs-skeleton'
import { EmptyTodayJobs } from './empty-today-jobs'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000, // Auto-refresh every minute
  })

  if (isLoading) {
    return <TodayJobsSkeleton />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
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

  // Sort: active jobs (EN_ROUTE, IN_PROGRESS) first, then by scheduled time
  const sorted = [...(jobs as TodayJob[])].sort((a, b) => {
    const activeStates = ['EN_ROUTE', 'IN_PROGRESS']
    const aActive = activeStates.includes(a.canonical_status) ? 0 : 1
    const bActive = activeStates.includes(b.canonical_status) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return new Date(a.scheduled_visit_date).getTime() - new Date(b.scheduled_visit_date).getTime()
  })

  return (
    <div className="space-y-3">
      {sorted.map((job) => (
        <TodayJobCard key={job.order_id} job={job} />
      ))}
    </div>
  )
}
