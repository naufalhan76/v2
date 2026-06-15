import { Suspense } from 'react'
import { History } from 'lucide-react'
import { HistoryList } from '@/components/technician/history-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianHistoryPage() {
  return (
    <div className="min-h-full bg-background pb-20 dark:bg-background" data-testid="technician-history">
      <div className="bg-primary text-white pt-12 pb-24 px-6 rounded-b-[80px]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-completed text-white">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Riwayat Pekerjaan</h1>
            <p className="text-sm text-muted-foreground leading-tight">
              Semua pekerjaan yang telah selesai atau dibatalkan
            </p>
          </div>
          <SyncStatus variant="compact" className="shrink-0 mt-0.5 hidden" />
        </div>
      </div>

      <div className="px-6 relative z-10">
        <Suspense fallback={<TodayJobsSkeleton />}>
          <HistoryList />
        </Suspense>
      </div>
    </div>
  )
}
