import { Suspense } from 'react'
import { HistoryList } from '@/components/technician/history-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianHistoryPage() {
  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-semibold">Riwayat Pekerjaan</h1>
        <p className="text-sm text-muted-foreground">
          Semua pekerjaan yang telah selesai
        </p>
      </div>

      <Suspense fallback={<TodayJobsSkeleton />}>
        <HistoryList />
      </Suspense>
    </div>
  )
}
