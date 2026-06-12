import { Skeleton } from '@/components/ui/skeleton'

export function HistorySkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-tech-bg-dark pb-24">
      {/* Header */}
      <div className="bg-[#211c59] text-white pt-12 pb-24 px-6 rounded-b-[80px] flex justify-between items-start">
        <div>
          <Skeleton className="h-8 w-48 bg-indigo-800/50 mb-2" />
          <Skeleton className="h-4 w-32 bg-indigo-800/50" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full bg-indigo-800/50" />
      </div>

      {/* Filter Tabs */}
      <div className="mx-6 bg-white dark:bg-[#1a1833] p-1 rounded-[32px] shadow border border-gray-100 dark:border-gray-800 -mt-10 relative z-10 flex">
        <Skeleton className="flex-1 h-12 rounded-[28px] bg-indigo-50 dark:bg-gray-700 animate-pulse" />
        <Skeleton className="flex-1 h-12 rounded-[28px] bg-transparent" />
        <Skeleton className="flex-1 h-12 rounded-[28px] bg-transparent" />
      </div>

      {/* Job Cards */}
      <div className="px-6 mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-[#1a1833] rounded-[32px] p-6 border border-gray-100 dark:border-gray-800 shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <Skeleton className="h-6 w-40 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              <Skeleton className="h-6 w-20 rounded-full bg-indigo-50 dark:bg-gray-700 animate-pulse" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
                <Skeleton className="h-4 w-32 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
                <Skeleton className="h-4 w-48 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
                <Skeleton className="h-5 w-24 bg-indigo-50 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
