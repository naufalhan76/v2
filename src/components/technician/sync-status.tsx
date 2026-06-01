'use client'

import * as React from 'react'
import { useOnlineSync } from '@/hooks/use-online-sync'
import { CloudOff, RefreshCw, AlertCircle, CheckCircle2, FileText, Image as ImageIcon, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
  const { isOnline, syncing, pending, lastResult, lastError, syncNow } = useOnlineSync()
  const [showSuccess, setShowSuccess] = React.useState(false)

  const pendingCount = pending.reports + pending.transitions + pending.photos
  const hasPending = pendingCount > 0

  React.useEffect(() => {
    if (isOnline && !syncing && pendingCount === 0 && lastResult && lastResult.errors.length === 0) {
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, syncing, pendingCount, lastResult])

  const isCompact = variant === 'compact'

  if (!isOnline) {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-destructive/20 h-10 min-w-[2.5rem] gap-2 cursor-default px-3", className)}
      >
        <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
        <CloudOff className="h-4 w-4 shrink-0" />
        {!isCompact && <span>Offline</span>}
        {hasPending && (
          <span className="flex h-5 items-center justify-center rounded-full bg-destructive/20 px-1.5 text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </Badge>
    )
  }

  if (lastError) {
    return (
      <button 
        onClick={() => void syncNow()}
        className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md"
      >
        <Badge 
          variant="outline" 
          className={cn("bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-destructive/20 h-10 min-w-[2.5rem] gap-2 cursor-pointer px-3", className)}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {!isCompact && <span className="max-w-[150px] truncate">Gagal: {lastError}</span>}
        </Badge>
      </button>
    )
  }

  if (syncing) {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors border-blue-500/20 h-10 min-w-[2.5rem] gap-2 cursor-default px-3", className)}
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        {!isCompact && <span>Mensinkronkan&hellip;</span>}
      </Badge>
    )
  }

  if (hasPending) {
    const trigger = (
      <button
        onClick={() => void syncNow()}
        className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md"
      >
        <Badge
          variant="outline"
          className={cn("bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border-amber-500/20 h-10 min-w-[2.5rem] gap-2 cursor-pointer px-3", className)}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          <RefreshCw className="h-4 w-4 shrink-0" />
          {!isCompact && <span>{pendingCount} tertunda</span>}
          {isCompact && (
            <span className="flex h-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </Badge>
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
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">Klik untuk sinkronkan sekarang</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (showSuccess) {
    return (
      <Badge 
        variant="outline" 
        className={cn("bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border-emerald-500/20 h-10 min-w-[2.5rem] gap-2 cursor-default px-3", className)}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {!isCompact && <span>Tersinkron</span>}
      </Badge>
    )
  }

  // default state: online, nothing pending, no recent result
  return (
    <Badge 
      variant="outline" 
      className={cn("bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border-emerald-500/20 h-10 min-w-[2.5rem] gap-2 cursor-default px-3", className)}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {!isCompact && <span>Online</span>}
    </Badge>
  )
}
