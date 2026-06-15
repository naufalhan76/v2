'use client'

import { CalendarDays, ClipboardList, Loader2 } from 'lucide-react'
import { SignaturePad } from '@/components/technician/signature-pad'
import { cn } from '@/lib/utils'

interface SignatureSectionProps {
  customerNameSigned: string
  onCustomerNameChange: (name: string) => void
  signatureDataUrl: string | null
  onSignatureDataUrlChange: (url: string | null) => void
  onSignatureBlobChange: (blob: Blob | null) => void
  nextServiceDate: string
  onNextServiceDateChange: (date: string) => void
  nextServiceNotes: string
  onNextServiceNotesChange: (notes: string) => void
  notes: string
  onNotesChange: (notes: string) => void
  actualPrice: number
  submitting: boolean
  onSubmit: () => void
}

export function SignatureSection({
  customerNameSigned,
  onCustomerNameChange,
  signatureDataUrl,
  onSignatureDataUrlChange,
  onSignatureBlobChange,
  nextServiceDate,
  onNextServiceDateChange,
  nextServiceNotes,
  onNextServiceNotesChange,
  notes,
  onNotesChange,
  actualPrice,
  submitting,
  onSubmit,
}: SignatureSectionProps) {
  return (
    <>
      {/* Signature section */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-border dark:bg-surface-muted">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-primary dark:bg-surface dark:text-brand-200">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary dark:text-foreground">
              Tanda Tangan &amp; Konfirmasi
            </h2>
            <p className="text-sm text-muted-foreground">
              Minta pelanggan menandatangani laporan ini.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="phase-c-customer-name" className="mb-1.5 block text-sm font-bold text-foreground dark:text-foreground">
              Nama Penandatangan
            </label>
            <input
              id="phase-c-customer-name"
              type="text"
              placeholder="Nama pelanggan yang bertanda tangan"
              value={customerNameSigned}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-border-strong dark:border-border bg-white dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:outline-none focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
            />
          </div>

          <SignaturePad
            onBlobChange={onSignatureBlobChange}
            onChange={onSignatureDataUrlChange}
            value={signatureDataUrl || undefined}
          />
        </div>
      </section>

      {/* Next service date & notes */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-border dark:bg-surface-muted">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-primary dark:bg-surface dark:text-brand-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary dark:text-foreground">
              Jadwal &amp; Catatan
            </h2>
            <p className="text-sm text-muted-foreground">
              Rekomendasi servis berikutnya dan catatan tambahan.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Notes textarea */}
          <div>
            <label htmlFor="phase-c-notes" className="mb-1.5 block text-sm font-bold text-foreground dark:text-foreground">
              Catatan Tambahan
            </label>
            <textarea
              id="phase-c-notes"
              placeholder="Catatan pengerjaan (opsional)"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-border-strong dark:border-border bg-white dark:bg-surface dark:text-foreground p-3 text-sm focus:border-primary focus:outline-none focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
            />
          </div>

          {/* Next service date */}
          <div>
            <label htmlFor="phase-c-next-date" className="mb-1.5 block text-sm font-bold text-foreground dark:text-foreground">
              Tanggal Servis Berikutnya
            </label>
            <input
              id="phase-c-next-date"
              type="date"
              value={nextServiceDate}
              onChange={(e) => onNextServiceDateChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-border-strong dark:border-border bg-white dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:outline-none focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
              aria-label="Tanggal servis berikutnya"
            />
          </div>

          {/* Next service notes */}
          <div>
            <label htmlFor="phase-c-next-notes" className="mb-1.5 block text-sm font-bold text-foreground dark:text-foreground">
              Catatan Servis Berikutnya
            </label>
            <input
              id="phase-c-next-notes"
              type="text"
              placeholder="Catatan servis berikutnya (opsional)"
              value={nextServiceNotes}
              onChange={(e) => onNextServiceNotesChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-border-strong dark:border-border bg-white dark:bg-surface dark:text-foreground px-3 text-sm focus:border-primary focus:outline-none focus:ring-primary dark:focus:border-primary dark:focus:ring-primary"
              aria-label="Catatan servis berikutnya"
            />
          </div>
        </div>
      </section>

      {/* Price summary */}
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:border-border dark:bg-surface-muted">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
            Total Material
          </span>
          <span className="text-lg font-bold text-primary dark:text-foreground">
            Rp {actualPrice.toLocaleString('id-ID')}
          </span>
        </div>
      </section>

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className={cn(
          'w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors active:scale-[0.98] disabled:opacity-60 dark:bg-primary-hover dark:hover:bg-primary-hover',
          submitting && 'cursor-wait'
        )}
        aria-label="Submit Laporan Akhir"
      >
        {submitting ? (
          <span className="flex items-center justify-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Menyimpan...
          </span>
        ) : (
          'Submit Laporan Akhir'
        )}
      </button>
    </>
  )
}
