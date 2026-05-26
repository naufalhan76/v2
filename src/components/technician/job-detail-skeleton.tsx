export function JobDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Back + status */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded bg-muted" />
        <div className="h-6 w-24 rounded-full bg-muted" />
      </div>

      {/* Customer card */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
        <div className="h-4 w-28 rounded bg-muted" />
      </div>

      {/* Service card */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>

      {/* Action button */}
      <div className="pt-2">
        <div className="h-12 w-full rounded-lg bg-muted" />
      </div>
    </div>
  )
}
