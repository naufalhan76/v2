import { Suspense } from 'react'
import { HomeHeader } from '@/components/technician/home-header'
import { TodayJobsList } from '@/components/technician/today-jobs-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianTodayPage() {
  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#0f0e1a] pb-24" data-testid="technician-home">
      <HomeHeader />

      <div className="px-6 relative z-10 space-y-4">
        <Suspense fallback={<TodayJobsSkeleton />}>
          <TodayJobsList />
        </Suspense>
      </div>
    </div>
  )
}
