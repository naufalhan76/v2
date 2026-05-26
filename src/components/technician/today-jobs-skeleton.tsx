export function TodayJobsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 animate-pulse"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-12 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
          </div>
          <div className="h-5 w-40 rounded bg-muted mb-2" />
          <div className="h-4 w-32 rounded bg-muted mb-1" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
