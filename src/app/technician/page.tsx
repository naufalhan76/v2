import { Suspense } from 'react'
import { TodayJobsList } from '@/components/technician/today-jobs-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianTodayPage() {
  return (
    <div className="space-y-4" data-testid="technician-home">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-semibold">Pekerjaan Hari Ini</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Jobs list */}
      <Suspense fallback={<TodayJobsSkeleton />}>
        <TodayJobsList />
      </Suspense>
    </div>
  )
}
