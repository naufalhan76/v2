'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { stopTimer, getActiveTimer } from '@/lib/offline/timer'
import { computeWorkDurationMinutes } from '@/lib/offline/time'
import { enqueuePhoto, enqueueReport, newIdempotencyKey } from '@/lib/offline/sync-manager'
import type { AcUnitReportItem, TechnicianReportPayload } from '@/app/api/schemas/technician'
import type { PhaseADraft } from './wizard-phase-a'
import { ConfirmationModal } from './confirmation-modal'
import { MaterialsSection } from './materials-section'
import { SignatureSection } from './signature-section'

type WizardPhaseCProps = {
  orderId: string
  phaseADraft: PhaseADraft
  technicianId: string
  onComplete: () => void
}

type UnitState = {
  materials: AcUnitReportItem['materials_used']
  photosAfter: string[]
  photoIds: string[]
}

export function WizardPhaseC({ orderId, phaseADraft, technicianId, onComplete }: WizardPhaseCProps): React.JSX.Element {
  const [unitStates, setUnitStates] = useState<UnitState[]>(() =>
    phaseADraft.units.map(() => ({ materials: [], photosAfter: [], photoIds: [] })),
  )
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const defaultNextDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0] })()
  const [nextServiceDate, setNextServiceDate] = useState(defaultNextDate)
  const [nextServiceNotes, setNextServiceNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const allPhotoIdsRef = useRef<string[]>([])
  const draftKey = `msn-tech-wizard-phase-c-draft-${orderId}`

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
        if (draft.unitStates !== undefined && Array.isArray(draft.unitStates)) setUnitStates(draft.unitStates)
      }
    } catch { /* corrupted draft */ }
  }, [draftKey])

  const saveDraft = useCallback(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ customerNameSigned, signatureDataUrl, nextServiceDate, nextServiceNotes, notes, unitStates })) } catch { /* quota exceeded */ }
  }, [customerNameSigned, signatureDataUrl, nextServiceDate, nextServiceNotes, notes, unitStates, draftKey])

  useEffect(() => { saveDraft() }, [saveDraft])

  const updateUnitState = useCallback((index: number, patch: Partial<UnitState>) => {
    setUnitStates((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)))
  }, [])

  const performSubmit = async () => {
    setShowModal(false)
    setSubmitting(true)
    try {
      const timerResult = stopTimer(orderId)
      const activeTimer = getActiveTimer()
      const workCompletedAt = timerResult?.work_completed_at ?? new Date().toISOString()
      const workStartedAt = activeTimer?.work_started_at ?? timerResult?.work_started_at ?? null
      const workDurationMinutes = workStartedAt ? computeWorkDurationMinutes(workStartedAt, workCompletedAt) : undefined
      const allMaterials = unitStates.flatMap((us) => us.materials)
      const photoIds: string[] = []
      if (signatureBlob) {
        const sigRecord = await enqueuePhoto({ orderId, acUnitIdx: -1, kind: 'signature', blob: signatureBlob, bytes: signatureBlob.size, width: 0, height: 0, mimeType: 'image/png' })
        photoIds.push(sigRecord.id)
      }
      photoIds.push(...allPhotoIdsRef.current)
      const acUnits: AcUnitReportItem[] = phaseADraft.units.map((unitDraft, idx) => {
        const us = unitStates[idx] ?? { materials: [], photosAfter: [], photoIds: [] }
        const identity = unitDraft.identity
        return { ac_unit_id: identity?.ac_unit_id ?? null, brand: identity?.brand ?? '', brand_id: identity?.brand_id ?? '', ac_type: identity?.ac_type ?? '', unit_type_id: identity?.unit_type_id ?? '', capacity_id: identity?.capacity_id ?? '', capacity_label: identity?.capacity_label ?? '', model_number: identity?.model_number ?? '', room_location: identity?.room_location ?? '', floor_level: null, position_detail: null, skipped: false, skip_reason: null, photos_before: [], photos_after: [], notes: null, materials_used: us.materials }
      })
      const payload: TechnicianReportPayload = {
        idempotency_key: newIdempotencyKey(), photos_before: [], photos_after: [], materials: allMaterials,
        actual_total_price: unitStates.reduce((sum, us) => sum + us.materials.reduce((s, m) => s + m.total, 0), 0),
        customer_signature_url: '', customer_name_signed: customerNameSigned, notes,
        work_started_at: workStartedAt, work_completed_at: workCompletedAt, work_duration_minutes: workDurationMinutes,
        next_service_recommendation_date: nextServiceDate || null, next_service_recommendation_notes: nextServiceNotes || null, ac_units: acUnits,
      }
      await enqueueReport({ orderId, technicianId, payload, photoIds })
      try { localStorage.removeItem(`msn-tech-wizard-draft-${orderId}`); localStorage.removeItem(draftKey) } catch { /* skip */ }
      onComplete()
    } catch (err: unknown) {
      console.error('Phase C submit error', err); setSubmitting(false); setShowModal(true)
    }
  }

  const actualPrice = unitStates.reduce((sum, us) => sum + us.materials.reduce((s, m) => s + m.total, 0), 0)

  useEffect(() => { allPhotoIdsRef.current = unitStates.flatMap((us) => us.photoIds) }, [unitStates])

  return (
    <section className="min-h-screen bg-background pb-8 dark:bg-background">
      <header className="rounded-b-[40px] bg-primary px-5 pt-10 pb-16 text-white">
        <p className="text-sm font-semibold text-white/80">Langkah 3 dari 3</p>
        <h1 className="mt-2 text-2xl font-bold">Detail Pekerjaan</h1>
        <p className="mt-1 text-sm text-white/80">Isi material, foto sesudah, tanda tangan, dan jadwal servis berikutnya.</p>
        <div className="mt-6 flex items-center" aria-label="Wizard stepper">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-white text-primary">{step}</span>
              {step < 3 && <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-500" />}
            </div>
          ))}
        </div>
      </header>
      <main className="-mt-10 space-y-5 px-5">
        {phaseADraft.units.map((unitDraft, index) => (
          <MaterialsSection key={unitDraft.unitIndex} unitDraft={unitDraft} unitState={unitStates[index] ?? { materials: [], photosAfter: [], photoIds: [] }} index={index} orderId={orderId} onUpdateState={updateUnitState} />
        ))}
        <SignatureSection
          customerNameSigned={customerNameSigned} onCustomerNameChange={setCustomerNameSigned}
          signatureDataUrl={signatureDataUrl} onSignatureDataUrlChange={setSignatureDataUrl} onSignatureBlobChange={setSignatureBlob}
          nextServiceDate={nextServiceDate} onNextServiceDateChange={setNextServiceDate}
          nextServiceNotes={nextServiceNotes} onNextServiceNotesChange={setNextServiceNotes}
          notes={notes} onNotesChange={setNotes}
          actualPrice={actualPrice} submitting={submitting} onSubmit={() => setShowModal(true)}
        />
      </main>
      <ConfirmationModal open={showModal} onConfirm={performSubmit} onCancel={() => setShowModal(false)} submitting={submitting} />
    </section>
  )
}
