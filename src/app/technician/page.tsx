import { Suspense } from 'react'
import { HomeHeader } from '@/components/technician/home-header'
import { TodayJobsList } from '@/components/technician/today-jobs-list'
import { TodayJobsSkeleton } from '@/components/technician/today-jobs-skeleton'

export default function TechnicianTodayPage() {
  return (
    <div className="min-h-full bg-slate-50 pb-20" data-testid="technician-home">
      {/* Indigo navy header banner — bleeds full-width, overlap curve */}
      <div className="bg-[#1C195F] text-white px-4 pt-10 pb-12 rounded-b-[40px]">
        <HomeHeader />
      </div>

      {/* Jobs list below the header, overlaps the curved banner */}
      <div className="px-4 -mt-6 relative z-10 space-y-4">
        <Suspense fallback={<TodayJobsSkeleton />}>
          <TodayJobsList />
        </Suspense>
      </div>
    </div>
  )
}
