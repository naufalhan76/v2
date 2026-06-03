'use client'

import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyTodayJobs() {
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['technician', 'jobs', 'today'] })
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center"
      data-testid="today-jobs-empty"
    >
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary/5"
        />
        <CalendarCheck2 className="relative h-7 w-7 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold tracking-tight mb-1">Tidak Ada Pekerjaan</h3>
      <p className="text-sm text-muted-foreground max-w-[260px] mb-5">
        Belum ada pekerjaan yang dijadwalkan untuk hari ini. Nikmati waktumu atau periksa
        pembaruan terbaru.
      </p>
      <Button
        type="button"
        size="default"
        onClick={handleRefresh}
        className="h-10 px-4"
      >
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Coba Lagi
      </Button>
    </div>
  )
}
