import { Skeleton } from '@/components/ui/skeleton'

export function TodayJobsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-hairline bg-background p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-4 w-56" />
        </div>
      ))}
    </div>
  )
}
