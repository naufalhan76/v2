import { Skeleton } from '@/components/ui/skeleton'

export function JobDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      {/* Curved Header Area with Back + status */}
      <div className="bg-primary pt-10 pb-8 px-5 rounded-b-[40px]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-28 bg-brand-700" />
          <Skeleton className="h-10 w-32 bg-brand-700 rounded-lg" />
        </div>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        {/* Customer card */}
        <div className="rounded-[32px] border border-border dark:border-border bg-white dark:bg-surface-muted p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] space-y-4 relative z-10">
          <Skeleton className="h-6 w-48 bg-brand-50 dark:bg-surface animate-pulse" />
          
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-brand-50 dark:bg-surface animate-pulse mt-0.5" />
            <Skeleton className="h-5 w-36 bg-brand-50 dark:bg-surface animate-pulse" />
          </div>
          
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-brand-50 dark:bg-surface animate-pulse mt-0.5" />
            <Skeleton className="h-5 w-32 bg-brand-50 dark:bg-surface animate-pulse" />
          </div>
          
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-brand-50 dark:bg-surface animate-pulse mt-0.5" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-5 w-full bg-brand-50 dark:bg-surface animate-pulse" />
              <Skeleton className="h-5 w-2/3 bg-brand-50 dark:bg-surface animate-pulse" />
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full shrink-0 bg-brand-50 dark:bg-surface animate-pulse mt-0.5" />
            <Skeleton className="h-5 w-28 bg-brand-50 dark:bg-surface animate-pulse" />
          </div>
        </div>

        {/* Service card */}
        <div className="rounded-[32px] border border-border dark:border-border bg-white dark:bg-surface-muted p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] space-y-4">
          <Skeleton className="h-4 w-32 bg-brand-50 dark:bg-surface animate-pulse mb-6" />
          
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-md shrink-0 bg-brand-50 dark:bg-surface animate-pulse" />
            <Skeleton className="h-6 w-40 bg-brand-50 dark:bg-surface animate-pulse" />
          </div>
          
          <div className="pl-9 space-y-2">
            <Skeleton className="h-4 w-32 bg-brand-50 dark:bg-surface animate-pulse" />
            <Skeleton className="h-4 w-48 bg-brand-50 dark:bg-surface animate-pulse" />
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2">
          <Skeleton className="h-14 w-full rounded-xl bg-brand-50 dark:bg-surface animate-pulse" />
        </div>
      </div>
    </div>
  )
}
