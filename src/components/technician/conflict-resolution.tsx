import React from 'react'
import { AlertTriangle, Download, Trash2, ShieldAlert, FileWarning } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type ConflictRecord } from '@/lib/offline/db'

export type ConflictResolutionProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictRecord[]
  onDiscard: (id: string) => Promise<void>
  onExport: (record: ConflictRecord) => void | Promise<void>
}

function getBadgeVariant(kind: string) {
  if (kind === 'CANCELLED') return 'destructive'
  if (kind === 'REASSIGNED' || kind === 'AUTH') return 'secondary' // or warning if available, using secondary for now since shadcn default has secondary/destructive
  return 'default'
}

function getBadgeLabel(kind: string) {
  if (kind === 'CANCELLED') return 'Dibatalkan'
  if (kind === 'REASSIGNED') return 'Dialihkan'
  if (kind === 'AUTH') return 'Sesi Habis'
  return 'Konflik'
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

function getSnapshotSummary(record: ConflictRecord) {
  if (!record.reportSnapshot) {
    if (record.transitionSnapshot) {
      return `Mencoba mengubah status pesanan menjadi ${record.transitionSnapshot.payload.to_status}`
    }
    return 'Tidak ada data laporan'
  }

  const payload = record.reportSnapshot.payload
  const numAc = payload.ac_units?.length || 0
  
  // Calculate total photos
  let totalPhotos = (payload.photos_before?.length || 0) + (payload.photos_after?.length || 0)
  if (payload.ac_units) {
    for (const unit of payload.ac_units) {
      totalPhotos += (unit.photos_before?.length || 0) + (unit.photos_after?.length || 0)
    }
  }

  const totalRp = formatRupiah(payload.actual_total_price || 0)

  return `Anda mencatat data untuk ${numAc} AC, ${totalPhotos} foto, total ${totalRp}`
}

export function ConflictResolution({
  open,
  onOpenChange,
  conflicts,
  onDiscard,
  onExport,
}: ConflictResolutionProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-full max-h-[100dvh] sm:max-h-[85vh] h-full sm:h-auto flex flex-col p-0 sm:p-6 overflow-hidden bg-canvas-soft dark:bg-primary border-0 sm:border sm:border-hairline rounded-none sm:rounded-xl">
        <div className="flex-none p-6 pb-4 bg-background dark:bg-primary/90 border-b border-hairline">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 text-destructive rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl">Order Berubah Saat Offline</DialogTitle>
            </div>
            <DialogDescription className="text-base text-ink-mute">
              Beberapa laporan gagal dikirim karena status order telah berubah di server atau sesi Anda berakhir. Anda dapat mengekspor laporan sebagai PDF sebelum membuangnya.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-0 sm:pt-4 sm:px-2 space-y-4 bg-canvas-soft dark:bg-canvas-soft">
          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-faint">
              <FileWarning className="w-12 h-12 mb-4 opacity-20" />
              <p>Tidak ada konflik</p>
            </div>
          ) : (
            conflicts.map((conflict) => (
              <div 
                key={conflict.id} 
                className="bg-background dark:bg-primary/90 border border-hairline dark:border-hairline-dark rounded-lg p-5 shadow-sm transition-all hover:shadow-md relative overflow-hidden"
              >
                {/* Decorative side accent based on kind */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  conflict.kind === 'CANCELLED' ? 'bg-destructive' : 
                  conflict.kind === 'REASSIGNED' ? 'bg-status-pending' : 
                  'bg-status-assigned'
                }`} />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-foreground font-mono tracking-tight">
                        {conflict.orderId}
                      </h3>
                      <Badge 
                        variant={getBadgeVariant(conflict.kind) as any}
                        className={`text-[10px] uppercase tracking-wider ${
                          conflict.kind === 'REASSIGNED' ? 'bg-status-pending/10 text-status-pending hover:bg-status-pending/20 dark:bg-status-pending/20 dark:text-status-pending' : ''
                        }`}
                      >
                        {getBadgeLabel(conflict.kind)}
                      </Badge>
                    </div>
                    {conflict.serverMessage && (
                      <p className="text-sm text-ink-mute flex items-start gap-1.5 mt-2 p-3 bg-canvas-soft dark:bg-canvas-soft rounded-lg border border-hairline dark:border-hairline-dark">
                        <ShieldAlert className="w-4 h-4 mt-0.5 text-ink-faint flex-shrink-0" />
                        <span>{conflict.serverMessage}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pl-2 mb-5">
                  <p className="text-sm font-medium text-foreground">
                    {getSnapshotSummary(conflict)}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pl-2 pt-2 border-t border-hairline dark:border-hairline-dark">
                  <Button 
                    variant="outline"
                    className="flex-1 border-hairline dark:border-hairline-dark hover:bg-canvas-soft"
                    onClick={() => onExport(conflict)}
                    disabled={!conflict.reportSnapshot}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export sebagai PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="flex-1 sm:flex-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDiscard(conflict.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Buang
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
