import { Skeleton } from '@/components/ui/skeleton'

export function OrderCardSkeleton() {
  return (
    <div className="rounded-lg bg-card border border-border/50 p-3 shadow-sm border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full mb-2" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
