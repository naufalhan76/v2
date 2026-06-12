import { Skeleton } from '@/components/ui/skeleton'

export function TodayJobsSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-tech-bg-dark pb-24">
      {/* Curved Header Area */}
      <div className="bg-[#211c59] pt-12 pb-32 px-6 rounded-b-[40px]">
        <Skeleton className="h-7 w-48 bg-indigo-800/50 mb-2" />
        <Skeleton className="h-4 w-32 bg-indigo-800/50 rounded-full" />
      </div>

      {/* Stat Cards 3-col Grid */}
      <div className="grid grid-cols-3 gap-3 px-6 -mt-24 relative z-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`stat-${i}`} className={`p-3 rounded-2xl ${i === 0 ? 'bg-[#211c59]' : 'bg-white dark:bg-[#1a1833] shadow'}`}>
            <Skeleton className={`h-8 w-8 rounded-full mb-2 ${i === 0 ? 'bg-indigo-800/50' : 'bg-indigo-50 dark:bg-gray-700 animate-pulse'}`} />
            <Skeleton className={`h-3 w-16 mb-1 ${i === 0 ? 'bg-indigo-800/50' : 'bg-indigo-50 dark:bg-gray-700 animate-pulse'}`} />
            <Skeleton className={`h-6 w-10 ${i === 0 ? 'bg-indigo-800/50' : 'bg-indigo-50 dark:bg-gray-700 animate-pulse'}`} />
          </div>
        ))}
      </div>

      {/* Job Cards Container */}
      <div className="mt-6 mx-6 bg-white dark:bg-[#1a1833] rounded-[32px] p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-6 w-32 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
          <Skeleton className="h-6 w-8 rounded-full bg-indigo-50 dark:bg-gray-700 animate-pulse" />
        </div>

        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1833] p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
                <Skeleton className="h-5 w-40 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <Skeleton className="h-4 w-48 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              <Skeleton className="h-4 w-full bg-indigo-50 dark:bg-gray-700 animate-pulse" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full rounded-xl bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              <Skeleton className="h-12 w-full rounded-xl bg-indigo-50 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
