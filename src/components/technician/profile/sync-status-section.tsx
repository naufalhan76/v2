import { SyncStatus } from '@/components/technician/sync-status'

interface SyncStatusSectionProps {
  pendingCount: number
  lastSyncTime: string
}

export function SyncStatusSection({ pendingCount, lastSyncTime }: SyncStatusSectionProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border dark:bg-surface-muted dark:border-border space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
        Status Sinkronisasi
      </h3>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold dark:text-foreground">Item Tertunda</p>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground">{pendingCount} item</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-sm font-semibold dark:text-foreground">Terakhir Sinkron</p>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground">{lastSyncTime}</p>
        </div>
      </div>

      <button
        onClick={() => {
          const btn = document.querySelector('[aria-label*="sinkronkan sekarang"]') as HTMLButtonElement
          if (btn) btn.click()
          else {
            const syncBtn = document.querySelector('[role="status"]') as HTMLElement
            if (syncBtn && syncBtn.tagName === 'BUTTON') syncBtn.click()
          }
        }}
        className="w-full border-2 border-border dark:border-border rounded-xl py-3 font-semibold text-primary dark:text-brand-200 flex items-center justify-center gap-2 hover:bg-muted dark:hover:bg-surface transition-colors"
      >
        <SyncStatus variant="compact" className="border-0 bg-transparent text-inherit p-0 h-auto" />
        Sinkronkan Sekarang
      </button>
    </div>
  )
}
