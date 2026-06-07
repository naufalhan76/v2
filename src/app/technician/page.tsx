import { Suspense } from 'react'
import { HomeHeader } from '@/components/technician/home-header'
import { TodayJobsList } from '@/components/technician/today-jobs-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianTodayPage() {
  return (
    <div className="min-h-full bg-canvas-soft -mx-4 -my-4" data-testid="technician-home">
      {/* Indigo navy header banner — bleeds full-width */}
      <div className="bg-primary text-primary-foreground px-4 pt-4 pb-5">
        <HomeHeader />
      </div>

      {/* Jobs list below the header */}
      <div className="px-4 py-4 space-y-5">
        <Suspense fallback={<TodayJobsSkeleton />}>
          <TodayJobsList />
        </Suspense>
      </div>
    </div>
  )
}
