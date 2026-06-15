import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-surface-muted animate-pulse", className)}
      {...props}
    />
  )
}

// Card Skeleton untuk mencegah layout shift
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-background text-foreground", className)}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-[120px]" />
          <Skeleton className="h-3 w-[150px]" />
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      <div className="border-b border-border">
        <div className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-4 flex-1',
                // Hide non-essential columns on mobile (keep first 2)
                i >= 2 && 'hidden md:block'
              )}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  'h-4 flex-1',
                  colIndex >= 2 && 'hidden md:block'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border-0 bg-surface-muted p-5">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-100" />
      <div className="flex items-center justify-between pl-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>
        </div>
        <Skeleton className="h-6 w-[60px] rounded-full" />
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
        <div style={{ height: `${height}px` }}>
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-[150px]" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end space-x-2">
        <Skeleton className="h-10 w-[100px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>
    </div>
  )
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
          <Skeleton className="h-8 w-[80px]" />
        </div>
      ))}
    </div>
  )
}

function AnimatedSkeleton(props: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton {...props} />
}

export { Skeleton, AnimatedSkeleton }
