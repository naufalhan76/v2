import { Suspense } from 'react'
import { History } from 'lucide-react'
import { HistoryList } from '@/components/technician/history-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianHistoryPage() {
  return (
    <div className="min-h-full bg-canvas-soft -mx-4 -my-4" data-testid="technician-history">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-3 pt-2">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Riwayat Pekerjaan</h1>
            <p className="text-xs text-ink-mute">
              Semua pekerjaan yang telah selesai atau dibatalkan
            </p>
          </div>
          <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
        </div>
      </div>

      {/* List */}
      <div className="px-4 pb-4">
        <Suspense fallback={<TodayJobsSkeleton />}>
          <HistoryList />
        </Suspense>
      </div>
    </div>
  )
}
