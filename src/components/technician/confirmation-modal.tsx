'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'

interface ConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}

export function ConfirmationModal({ open, onConfirm, onCancel, submitting }: ConfirmationModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-sm rounded-[32px] bg-white dark:bg-surface-muted p-8 text-center shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-completed">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>

        <h2 id="modal-title" className="mb-2 text-2xl font-bold text-primary dark:text-foreground">
          Konfirmasi Submit
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
          Pastikan semua data, material, foto sesudah, dan tanda tangan sudah benar.
          Laporan yang sudah disimpan akan dikirim ke sistem.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex w-full items-center justify-center bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-60 dark:bg-primary-hover dark:hover:bg-primary-hover"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Ya, Simpan'
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="w-full border-2 border-border rounded-xl py-4 font-semibold text-primary hover:bg-muted transition-colors active:scale-[0.98] disabled:opacity-60 dark:border-border dark:text-foreground dark:bg-transparent dark:hover:bg-surface"
          >
            Kembali
          </button>
        </div>
      </div>
    </div>
  )
}
