import { CalendarOff } from 'lucide-react'

export function EmptyTodayJobs() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="today-jobs-empty">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <CalendarOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium mb-1">Tidak Ada Pekerjaan</h3>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        Belum ada pekerjaan yang dijadwalkan untuk hari ini.
      </p>
    </div>
  )
}
