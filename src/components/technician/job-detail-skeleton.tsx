import { Skeleton } from '@/components/ui/skeleton'

export function JobDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Back + status */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Customer card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 shrink-0 mt-0.5" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Service card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="pl-6 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Action button */}
      <div className="pt-2 pb-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
