import { Suspense } from 'react'
import { History } from 'lucide-react'
import { HistoryList } from '@/components/technician/history-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianHistoryPage() {
  return (
    <div className="min-h-full bg-bg-gray-faded pb-20" data-testid="technician-history">
      {/* Header Banner */}
      <div className="bg-navy-deep text-white px-6 pt-12 pb-20 rounded-b-[40px]">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Riwayat Pekerjaan</h1>
            <p className="text-sm text-gray-300 leading-tight mt-1">
              Semua pekerjaan yang telah selesai atau dibatalkan
            </p>
          </div>
          <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
        </div>
      </div>

      {/* List Overlapping */}
      <div className="px-6 -mt-10 relative z-10">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          <Suspense fallback={<TodayJobsSkeleton />}>
            <HistoryList />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
