'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, Loader2, Snowflake } from 'lucide-react'

import { MaterialInput } from '@/components/technician/material-input'
import { PhotoUploadOffline } from '@/components/technician/photo-upload-offline'
import { SignaturePad } from '@/components/technician/signature-pad'
import { stopTimer, getActiveTimer } from '@/lib/offline/timer'
import { computeWorkDurationMinutes } from '@/lib/offline/time'
import { enqueuePhoto, enqueueReport, newIdempotencyKey } from '@/lib/offline/sync-manager'
import type { AcUnitReportItem, TechnicianReportPayload } from '@/app/api/schemas/technician'
import { cn } from '@/lib/utils'
import type { PhaseADraft } from './wizard-phase-a'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardPhaseCProps = {
  orderId: string
  phaseADraft: PhaseADraft
  onComplete: () => void
}

type UnitState = {
  materials: AcUnitReportItem['materials_used']
  photosAfter: string[]
  photoIds: string[]
}

type ConfirmationModalProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}

// ---------------------------------------------------------------------------
// Confirmation Modal (matches ui-style-reference.md spec)
// ---------------------------------------------------------------------------

function ConfirmationModal({ open, onConfirm, onCancel, submitting }: ConfirmationModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-sm rounded-[32px] bg-white dark:bg-[#1a1833] p-8 text-center shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#4caf50]">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>

        <h2 id="modal-title" className="mb-2 text-2xl font-bold text-[#1A1C4E] dark:text-white">
          Konfirmasi Submit
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Pastikan semua data, material, foto sesudah, dan tanda tangan sudah benar.
          Laporan yang sudah disimpan akan dikirim ke sistem.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-[#1A1C4E] dark:bg-[#2d2a75] py-4 font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
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
            className="w-full rounded-xl border-2 border-[#1A1C4E] dark:border-indigo-400 bg-white dark:bg-[#252243] py-4 font-bold text-[#1A1C4E] dark:text-white transition-all active:scale-[0.98] disabled:opacity-60"
          >
            Kembali
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardPhaseC({ orderId, phaseADraft, onComplete }: WizardPhaseCProps): React.JSX.Element {
  // --- Per-unit state ---
  const [unitStates, setUnitStates] = useState<UnitState[]>(() =>
    phaseADraft.units.map(() => ({
      materials: [],
      photosAfter: [],
      photoIds: [],
    }))
  )

  // --- Signature ---
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)

  // --- Next service ---
  const defaultNextDate = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return d.toISOString().split('T')[0]
  })()
  const [nextServiceDate, setNextServiceDate] = useState(defaultNextDate)
  const [nextServiceNotes, setNextServiceNotes] = useState('')

  // --- General notes ---
  const [notes, setNotes] = useState('')

  // --- Submit state ---
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Track all photo IDs across units for the report
  const allPhotoIdsRef = useRef<string[]>([])

  // --- Draft persistence ---
  const draftKey = `msn-tech-wizard-phase-c-draft-${orderId}`

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.customerNameSigned !== undefined) setCustomerNameSigned(draft.customerNameSigned)
        if (draft.signatureDataUrl !== undefined) setSignatureDataUrl(draft.signatureDataUrl)
        if (draft.nextServiceDate !== undefined) setNextServiceDate(draft.nextServiceDate)
        if (draft.nextServiceNotes !== undefined) setNextServiceNotes(draft.nextServiceNotes)
        if (draft.notes !== undefined) setNotes(draft.notes)
        if (draft.unitStates !== undefined && Array.isArray(draft.unitStates)) {
          setUnitStates(draft.unitStates)
        }
      }
    } catch {
      // corrupted draft — silently skip
    }
  }, [draftKey])

  // Save draft
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          customerNameSigned,
          signatureDataUrl,
          nextServiceDate,
          nextServiceNotes,
          notes,
          unitStates,
        })
      )
    } catch {
      // quota exceeded — silently skip
    }
  }, [customerNameSigned, signatureDataUrl, nextServiceDate, nextServiceNotes, notes, unitStates, draftKey])

  useEffect(() => {
    saveDraft()
  }, [saveDraft])

  // --- Update unit state helper ---
  const updateUnitState = useCallback(
    (index: number, patch: Partial<UnitState>) => {
      setUnitStates((prev) =>
        prev.map((u, i) => (i === index ? { ...u, ...patch } : u))
      )
    },
    []
  )

  // --- Submit ---
  const handleSubmitClick = () => {
    setShowModal(true)
  }

  const performSubmit = async () => {
    setShowModal(false)
    setSubmitting(true)

    try {
      // 1. Stop timer
      const timerResult = stopTimer(orderId)
      const activeTimer = getActiveTimer()

      const workCompletedAt = timerResult?.work_completed_at ?? new Date().toISOString()
      const workStartedAt = activeTimer?.work_started_at ?? timerResult?.work_started_at ?? null
      const workDurationMinutes =
        workStartedAt ? computeWorkDurationMinutes(workStartedAt, workCompletedAt) : undefined

      // 2. Build materials list from all units
      const allMaterials = unitStates.flatMap((us) => us.materials)

      // 3. Enqueue signature photo
      const photoIds: string[] = []
      if (signatureBlob) {
        const sigRecord = await enqueuePhoto({
          orderId,
          acUnitIdx: -1,
          kind: 'signature',
          blob: signatureBlob,
          bytes: signatureBlob.size,
          width: 0,
          height: 0,
          mimeType: 'image/png',
        })
        photoIds.push(sigRecord.id)
      }

      // 4. Add per-unit after photo IDs
      photoIds.push(...allPhotoIdsRef.current)

      // 5. Build AC units payload — merge Phase A draft identity with Phase C data
      const acUnits: AcUnitReportItem[] = phaseADraft.units.map((unitDraft, idx) => {
        const us = unitStates[idx] ?? { materials: [], photosAfter: [], photoIds: [] }
        const identity = unitDraft.identity

        const base: AcUnitReportItem = {
          ac_unit_id: identity?.ac_unit_id ?? null,
          brand: identity?.brand ?? '',
          brand_id: identity?.brand_id ?? '',
          ac_type: identity?.ac_type ?? '',
          unit_type_id: identity?.unit_type_id ?? '',
          capacity_id: identity?.capacity_id ?? '',
          capacity_label: identity?.capacity_label ?? '',
          model_number: identity?.model_number ?? '',
          room_location: identity?.room_location ?? '',
          floor_level: null,
          position_detail: null,
          skipped: false,
          skip_reason: null,
          photos_before: [],
          photos_after: [],
          notes: null,
          materials_used: us.materials,
        }

        return base
      })

      // 6. Build full payload
      const payload: TechnicianReportPayload = {
        idempotency_key: newIdempotencyKey(),
        photos_before: [],
        photos_after: [],
        materials: allMaterials,
        actual_total_price: unitStates.reduce((sum, us) => {
          return sum + us.materials.reduce((s, m) => s + m.total, 0)
        }, 0),
        customer_signature_url: '',
        customer_name_signed: customerNameSigned,
        notes,
        work_started_at: workStartedAt,
        work_completed_at: workCompletedAt,
        work_duration_minutes: workDurationMinutes,
        next_service_recommendation_date: nextServiceDate || null,
        next_service_recommendation_notes: nextServiceNotes || null,
        ac_units: acUnits,
      }

      // 7. Enqueue report
      const technicianId = 'current-technician' // From auth context in parent
      await enqueueReport({
        orderId,
        technicianId,
        payload,
        photoIds,
      })

      // 8. Clear drafts
      try {
        localStorage.removeItem(`msn-tech-wizard-draft-${orderId}`)
        localStorage.removeItem(draftKey)
      } catch {
        // silently skip
      }

      // 9. Navigate away
      onComplete()
    } catch (err: unknown) {
      console.error('Phase C submit error', err)
      setSubmitting(false)
      // Show error in modal or toast — for now re-open modal
      setShowModal(true)
    }
  }

  // --- Aggregate material cost ---
  const actualPrice = unitStates.reduce((sum, us) => {
    return sum + us.materials.reduce((s, m) => s + m.total, 0)
  }, 0)

  // --- Collect all photo IDs from units for ref ---
  useEffect(() => {
    allPhotoIdsRef.current = unitStates.flatMap((us) => us.photoIds)
  }, [unitStates])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="min-h-screen bg-[#F8FAFC] pb-8 dark:bg-[#0f1024]">
      {/* Header */}
      <header className="rounded-b-[40px] bg-[#1A1C4E] px-5 pt-10 pb-16 text-white">
        <p className="text-sm font-semibold text-white/80">Langkah 3 dari 3</p>
        <h1 className="mt-2 text-2xl font-bold">Detail Pekerjaan</h1>
        <p className="mt-1 text-sm text-white/80">
          Isi material, foto sesudah, tanda tangan, dan jadwal servis berikutnya.
        </p>

        <div className="mt-6 flex items-center gap-3" aria-label="Wizard stepper">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex flex-1 items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                  step < 3
                    ? 'bg-white text-[#1A1C4E] ring-4 ring-white/30'
                    : 'bg-white text-[#1A1C4E] ring-4 ring-white/40'
                )}
              >
                {step}
              </span>
              {step < 3 && <span className="ml-3 h-0.5 flex-1 rounded-full bg-white/30" />}
            </div>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="-mt-10 space-y-5 px-5">
        {/* Per-unit sections */}
        {phaseADraft.units.map((unitDraft, index) => {
          const us = unitStates[index] ?? { materials: [], photosAfter: [], photoIds: [] }
          const identity = unitDraft.identity

          return (
            <section
              key={unitDraft.unitIndex}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1a1833]"
            >
              {/* Unit header */}
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A1C4E]/10 text-[#1A1C4E]">
                  <Snowflake className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1A1C4E] dark:text-white">
                    AC {index + 1}
                  </h2>
                  {identity && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {identity.brand} — {identity.room_location}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Addons / Materials */}
                <MaterialInput
                  value={us.materials}
                  onChange={(materials) => updateUnitState(index, { materials })}
                />

                {/* After photos */}
                <PhotoUploadOffline
                  orderId={orderId}
                  acUnitIdx={index}
                  kind="after"
                  value={us.photosAfter}
                  onChange={(urls, photoIds) =>
                    updateUnitState(index, { photosAfter: urls, photoIds })
                  }
                  min={1}
                  max={5}
                />
              </div>
            </section>
          )
        })}

        {/* Signature section */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1a1833]">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A1C4E]/10 text-[#1A1C4E]">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A1C4E] dark:text-white">
                Tanda Tangan &amp; Konfirmasi
              </h2>
              <p className="text-sm text-gray-500">
                Minta pelanggan menandatangani laporan ini.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="phase-c-customer-name" className="mb-1.5 block text-sm font-bold text-gray-800 dark:text-white">
                Nama Penandatangan
              </label>
              <input
                id="phase-c-customer-name"
                type="text"
                placeholder="Nama pelanggan yang bertanda tangan"
                value={customerNameSigned}
                onChange={(e) => setCustomerNameSigned(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:outline-none focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
              />
            </div>

            <SignaturePad
              onBlobChange={setSignatureBlob}
              onChange={setSignatureDataUrl}
              value={signatureDataUrl || undefined}
            />
          </div>
        </section>

        {/* Next service date & notes */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1a1833]">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A1C4E]/10 text-[#1A1C4E]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A1C4E] dark:text-white">
                Jadwal &amp; Catatan
              </h2>
              <p className="text-sm text-gray-500">
                Rekomendasi servis berikutnya dan catatan tambahan.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Notes textarea */}
            <div>
              <label htmlFor="phase-c-notes" className="mb-1.5 block text-sm font-bold text-gray-800 dark:text-white">
                Catatan Tambahan
              </label>
              <textarea
                id="phase-c-notes"
                placeholder="Catatan pengerjaan (opsional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252243] dark:text-white p-3 text-sm focus:border-[#1A1C4E] focus:outline-none focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
              />
            </div>

            {/* Next service date */}
            <div>
              <label htmlFor="phase-c-next-date" className="mb-1.5 block text-sm font-bold text-gray-800 dark:text-white">
                Tanggal Servis Berikutnya
              </label>
              <input
                id="phase-c-next-date"
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:outline-none focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                aria-label="Tanggal servis berikutnya"
              />
            </div>

            {/* Next service notes */}
            <div>
              <label htmlFor="phase-c-next-notes" className="mb-1.5 block text-sm font-bold text-gray-800 dark:text-white">
                Catatan Servis Berikutnya
              </label>
              <input
                id="phase-c-next-notes"
                type="text"
                placeholder="Catatan servis berikutnya (opsional)"
                value={nextServiceNotes}
                onChange={(e) => setNextServiceNotes(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252243] dark:text-white px-3 text-sm focus:border-[#1A1C4E] focus:outline-none focus:ring-[#1A1C4E] dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                aria-label="Catatan servis berikutnya"
              />
            </div>
          </div>
        </section>

        {/* Price summary */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1a1833]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-[#a5a3b5]">
              Total Material
            </span>
            <span className="text-lg font-bold text-[#211c59] dark:text-white">
              Rp {actualPrice.toLocaleString('id-ID')}
            </span>
          </div>
        </section>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={submitting}
          className={cn(
            'w-full rounded-xl bg-[#1A1C4E] py-4 font-bold text-white shadow-sm transition-all active:scale-[0.99] disabled:opacity-60',
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
      </main>

      {/* Confirmation modal */}
      <ConfirmationModal
        open={showModal}
        onConfirm={performSubmit}
        onCancel={() => setShowModal(false)}
        submitting={submitting}
      />
    </section>
  )
}
