'use client'

import * as React from 'react'
import { useOnlineSync } from '@/hooks/use-online-sync'
import { deleteStuckPhotos, getStuckPhotoCount } from '@/lib/offline/db-photos'
import { useToast } from '@/hooks/use-toast'
import {
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type SyncStatusProps = {
  /** Optional className for layout overrides. */
  className?: string
  /** Compact: only icon + counter. Full: icon + label + counter. */
  variant?: 'compact' | 'full'
}

export function SyncStatus({ className, variant = 'full' }: SyncStatusProps) {
  const { isOnline, syncing, pending, lastResult, lastError, syncNow, errors, needsAttention } = useOnlineSync()
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [stuckPhotoCount, setStuckPhotoCount] = React.useState<number>(0)
  const [purging, setPurging] = React.useState(false)
  const { toast } = useToast()

  const pendingCount = pending.reports + pending.transitions + pending.photos
  const hasPending = pendingCount > 0
  const authError = errors.find((error) => error.status === 'auth-error')
  const attentionErrors = errors.filter((error) => error.status === 'needs-attention')
  const hasSyncErrors = errors.length > 0

  React.useEffect(() => {
    if (isOnline && !syncing && pendingCount === 0 && lastResult && lastResult.errors.length === 0) {
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, syncing, pendingCount, lastResult])

  React.useEffect(() => {
    if (pending.photos > 0) {
      getStuckPhotoCount().then(setStuckPhotoCount).catch(() => setStuckPhotoCount(0))
    } else {
      setStuckPhotoCount(0)
    }
  }, [pending.photos])

  async function handlePurgeStuckPhotos() {
    if (!window.confirm(`Hapus ${stuckPhotoCount} foto yang gagal sync? Foto yang masih dirujuk laporan tidak akan dihapus.`)) return

    setPurging(true)
    try {
      const deleted = await deleteStuckPhotos()
      toast({
        title: 'Foto Dihapus',
        description: `${deleted} foto gagal sync berhasil dihapus`,
      })
      await syncNow({ bypassBackoff: true })
      const remaining = await getStuckPhotoCount()
      setStuckPhotoCount(remaining)
    } catch (err) {
      toast({
        title: 'Gagal',
        description: err instanceof Error ? err.message : 'Gagal menghapus foto',
        variant: 'destructive',
      })
    } finally {
      setPurging(false)
    }
  }

  const isCompact = variant === 'compact'
  const baseClass = cn(
    'inline-flex items-center h-9 gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors cursor-default',
    className
  )

  if (!isOnline) {
    return (
      <div
        className={cn(
          baseClass,
          'border-status-pending bg-status-pending text-white'
        )}
        role="status"
        aria-label="Tidak ada koneksi"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {!isCompact && <span>Offline</span>}
        {hasPending && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-status-pending px-1.5 text-[10px] font-bold tabular-nums">
            {pendingCount}
          </span>
        )}
      </div>
    )
  }

  if (lastError) {
    return (
      <button
        type="button"
        onClick={() => void syncNow({ bypassBackoff: true })}
        className={cn(
          baseClass,
          'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive cursor-pointer'
        )}
        aria-label={`Sinkronisasi gagal: ${lastError}. Ketuk untuk coba lagi.`}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {!isCompact && (
          <span className="max-w-[150px] truncate">Gagal: {lastError}</span>
        )}
      </button>
    )
  }

  if (syncing) {
    return (
      <div
        className={cn(baseClass, 'border-primary bg-primary text-primary-foreground')}
        role="status"
        aria-label="Sedang menyinkronkan"
      >
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        {!isCompact && <span>Mensinkronkan&hellip;</span>}
      </div>
    )
  }

  if (hasPending) {
    const trigger = (
      <button
        type="button"
        onClick={() => void syncNow({ bypassBackoff: true })}
        className={cn(
          baseClass,
          'border-status-pending bg-status-pending text-white hover:bg-status-pending cursor-pointer'
        )}
        aria-label={`${pendingCount} item tertunda${needsAttention > 0 ? `, ${needsAttention} perlu perhatian` : ''}. Ketuk untuk sinkronkan sekarang.`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {!isCompact && (
          <span className="tabular-nums">
            {authError ? 'Login ulang diperlukan' : needsAttention > 0 ? `${needsAttention} perlu perhatian` : `${pendingCount} tertunda`}
          </span>
        )}
        {needsAttention > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-status-pending px-1.5 text-[10px] font-bold tabular-nums">
            {needsAttention}
          </span>
        )}
        {isCompact && needsAttention === 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-status-pending px-1.5 text-[10px] font-bold tabular-nums">
            {pendingCount}
          </span>
        )}
      </button>
    )

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="space-y-1.5">
            <p className="text-xs font-semibold">Detail Tertunda</p>
            <div className="flex items-center gap-2 text-xs">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span>{pending.reports} laporan</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
              <span>{pending.photos} foto</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
              <span>{pending.transitions} transisi</span>
            </div>
            {hasSyncErrors && (
              <div className="space-y-1 border-t pt-1">
                {authError && (
                  <p className="text-xs font-medium text-destructive">
                    Login ulang diperlukan: {authError.message.replace(/^AUTH_ERROR:\s*/, '')}
                  </p>
                )}
                {attentionErrors.map((error) => (
                  <p key={`${error.kind}-${error.key}`} className="text-xs font-medium text-status-pending">
                    Perlu perhatian: {error.message.replace(/^NEEDS_ATTENTION:\s*/, '')}
                  </p>
                ))}
              </div>
            )}
            {stuckPhotoCount > 0 && (
              <>
                <div className="border-t pt-1.5 mt-1">
                  <button
                    type="button"
                    disabled={purging}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handlePurgeStuckPhotos()
                    }}
                    className="w-full text-left text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
                  >
                    {purging ? 'Menghapus...' : `Hapus ${stuckPhotoCount} Foto Gagal Sync`}
                  </button>
                </div>
              </>
            )}
            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              Klik untuk sinkronkan sekarang
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (showSuccess) {
    return (
      <div
        className={cn(
          baseClass,
          'border-status-completed bg-status-completed text-white'
        )}
        role="status"
        aria-label="Sinkronisasi berhasil"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {!isCompact && <span>Tersinkron</span>}
      </div>
    )
  }

  // default state: online, nothing pending, no recent result
  return (
    <div
      className={cn(
        baseClass,
        'border-status-completed bg-status-completed text-white'
      )}
      role="status"
      aria-label="Online dan tersinkron"
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {!isCompact && <span>Online</span>}
    </div>
  )
}
