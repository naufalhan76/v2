import { Suspense } from 'react'
import { History } from 'lucide-react'
import { HistoryList } from '@/components/technician/history-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'
import { SyncStatus } from '@/components/technician/sync-status'

export default function TechnicianHistoryPage() {
  return (
    <div className="space-y-5" data-testid="technician-history">
      {/* Header */}
      <div className="flex items-start gap-3 pt-2">
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <History className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Riwayat Pekerjaan</h1>
          <p className="text-xs text-muted-foreground">
            Semua pekerjaan yang telah selesai atau dibatalkan
          </p>
        </div>
        <SyncStatus variant="compact" className="shrink-0 mt-0.5" />
      </div>

      {/* List */}
      <Suspense fallback={<TodayJobsSkeleton />}>
        <HistoryList />
      </Suspense>
    </div>
  )
}
