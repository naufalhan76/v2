'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Calendar, RefreshCw } from 'lucide-react'

export function EmptyTodayJobs() {
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['technician', 'jobs', 'today'] })
  }

  return (
    <div
      className="bg-white dark:bg-surface-muted rounded-[40px] p-6 flex flex-col items-center text-center shadow-2xl"
      data-testid="today-jobs-empty"
    >
      <div className="bg-muted dark:bg-surface p-6 rounded-full mb-6">
        <Calendar className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold mb-4 text-primary dark:text-foreground">Tidak Ada Pekerjaan</h3>
      <p className="text-muted-foreground text-sm mb-8 px-2 leading-loose">
        Belum ada pekerjaan yang dijadwalkan untuk hari ini. Nikmati waktumu atau periksa
        pembaruan terbaru.
      </p>
      <button
        type="button"
        onClick={handleRefresh}
        className="flex items-center justify-center border-2 border-border rounded-xl py-3 text-primary font-semibold px-8 hover:bg-muted transition-colors dark:border-border dark:text-foreground dark:hover:bg-surface"
      >
        <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
        Coba Lagi
      </button>
    </div>
  )
}
