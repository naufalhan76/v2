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
      className="bg-white dark:bg-[#1a1833] rounded-[40px] p-6 flex flex-col items-center text-center shadow-2xl"
      data-testid="today-jobs-empty"
    >
      <div className="bg-gray-100 dark:bg-[#252243] p-6 rounded-full mb-6">
        <Calendar className="w-10 h-10 text-gray-500" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold mb-4 text-[#1e1b4b] dark:text-white">Tidak Ada Pekerjaan</h3>
      <p className="text-gray-400 text-sm mb-8 px-2 leading-loose">
        Belum ada pekerjaan yang dijadwalkan untuk hari ini. Nikmati waktumu atau periksa
        pembaruan terbaru.
      </p>
      <button
        type="button"
        onClick={handleRefresh}
        className="flex items-center justify-center border-2 border-gray-200 rounded-xl py-3 text-[#211c59] font-semibold px-8 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-white dark:hover:bg-[#252243]"
      >
        <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
        Coba Lagi
      </button>
    </div>
  )
}
