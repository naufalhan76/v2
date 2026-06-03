export function JobDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Back + status */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded bg-muted/60 animate-pulse" />
        <div className="h-6 w-24 rounded-full bg-muted/60 animate-pulse" />
      </div>

      {/* Customer card */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-6 w-48 rounded bg-muted/60 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse shrink-0" />
          <div className="h-4 w-36 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse shrink-0" />
          <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse shrink-0 mt-0.5" />
          <div className="h-8 w-56 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse shrink-0" />
          <div className="h-4 w-28 rounded bg-muted/60 animate-pulse" />
        </div>
      </div>

      {/* Service card */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
        <div className="flex items-center gap-2 mt-2">
          <div className="h-4 w-4 rounded bg-muted/60 animate-pulse shrink-0" />
          <div className="h-4 w-40 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="pl-6 space-y-2">
          <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted/60 animate-pulse" />
        </div>
      </div>

      {/* Action button */}
      <div className="pt-2 pb-4">
        <div className="h-12 w-full rounded-lg bg-muted/60 animate-pulse" />
      </div>
    </div>
  )
}
