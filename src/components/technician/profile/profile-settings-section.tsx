import { AlertTriangle, Bell, BellOff, Info } from 'lucide-react'
import { TechnicianThemeToggle } from '@/components/technician/theme-toggle'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PushUiState } from './profile-types'
import { pushHelpText } from './profile-types'

interface ProfileSettingsSectionProps {
  push: PushUiState
  switchChecked: boolean
  switchDisabled: boolean
  onPushToggle: (next: boolean) => void
}

export function ProfileSettingsSection({
  push,
  switchChecked,
  switchDisabled,
  onPushToggle,
}: ProfileSettingsSectionProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border dark:bg-surface-muted dark:border-border space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
        Pengaturan Tampilan
      </h3>
      <TechnicianThemeToggle />

      <div className="h-px bg-muted dark:bg-muted my-2" />

      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
        Pengaturan Notifikasi
      </h3>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'p-2 rounded-lg',
            push.kind === 'enabled' ? 'bg-brand-50 dark:bg-surface text-primary dark:text-brand-200' : 'bg-muted dark:bg-muted text-muted-foreground'
          )}>
            {push.kind === 'enabled' ? (
              <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <BellOff className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold dark:text-foreground">Notifikasi Push</p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground line-clamp-1">{pushHelpText(push)}</p>
          </div>
        </div>
        <Switch
          checked={switchChecked}
          disabled={switchDisabled}
          onCheckedChange={onPushToggle}
          aria-label="Toggle notifikasi push"
        />
      </div>

      {push.kind === 'denied' && <PushDeniedAlert />}
      {push.kind === 'unsupported' && <PushUnsupportedAlert />}
    </div>
  )
}

function PushDeniedAlert() {
  return (
    <div className="flex gap-2 rounded-xl border border-status-cancelled/30 dark:border-status-cancelled bg-status-cancelled-bg dark:bg-status-cancelled-bg p-4 text-xs text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p>
        Notifikasi diblokir oleh browser. Buka pengaturan situs di browser kamu, izinkan
        notifikasi, lalu refresh halaman ini.
      </p>
    </div>
  )
}

function PushUnsupportedAlert() {
  return (
    <div className="flex gap-2 rounded-xl border border-border dark:border-border bg-muted dark:bg-surface-muted p-4 text-xs text-muted-foreground dark:text-muted-foreground">
      <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p>Browser ini tidak mendukung notifikasi push. Coba pakai Chrome atau Safari versi terbaru.</p>
    </div>
  )
}
