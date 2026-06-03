import { Suspense } from 'react'
import { HomeHeader } from '@/components/technician/home-header'
import { TodayJobsList } from '@/components/technician/today-jobs-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianTodayPage() {
  return (
    <div className="space-y-5" data-testid="technician-home">
      {/* Header with greeting + stats */}
      <HomeHeader />

      {/* Jobs list */}
      <Suspense fallback={<TodayJobsSkeleton />}>
        <TodayJobsList />
      </Suspense>
    </div>
  )
}
