'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Send,
  Loader2,
  Snowflake,
  PenLine,
  CalendarDays,
  ClipboardCheck,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { createClient } from '@/lib/supabase-browser'
import { enqueueReport, enqueuePhoto, newIdempotencyKey } from '@/lib/offline/sync-manager'
import type { TechnicianReportPayload, AcUnitReportItem } from '@/app/api/schemas/technician'
import { useToast } from '@/hooks/use-toast'
import { AcUnitForm } from '@/components/technician/ac-unit-form'
import { SignaturePad } from '@/components/technician/signature-pad'
import { SyncStatus } from '@/components/technician/sync-status'
import { cn } from '@/lib/utils'
import { getJobSnapshot, type LocalJobSnapshot } from '@/lib/offline/snapshot'
import { computeWorkDurationMinutes } from '@/lib/offline/time'

// Shape returned by GET /api/technician/jobs/[id]
type JobContext = {
  order_id: string
  status: string
  canonical_status: string
  has_report: boolean
  report_id: string | null
  description?: string | null
  scheduled_visit_date?: string | null
  customers?: {
    customer_id?: string | null
    customer_name?: string | null
    primary_contact_person?: string | null
    phone_number?: string | null
    email?: string | null
  } | null
  order_items?: Array<{
    order_item_id: string
    ac_unit_id?: string | null
    service_type?: string | null
    quantity?: number | null
    description?: string | null
    estimated_price?: number | null
    locations?: {
      location_id?: string | null
      full_address?: string | null
      house_number?: string | null
      city?: string | null
    } | null
    ac_units?: {
      ac_unit_id: string
      brand?: string | null
      brand_id?: string | null
      model_number?: string | null
      serial_number?: string | null
      installation_date?: string | null
      ac_type?: string | null
      unit_type_id?: string | null
      capacity_id?: string | null
      room_location?: string | null
      floor_level?: string | null
      position_detail?: string | null
      capacity_ranges?: {
        capacity_label?: string | null
      } | Array<{ capacity_label?: string | null }> | null
    } | null
  }>
  order_technicians?: Array<{
    id: string
    technician_id: string
    role: string
    assigned_at?: string | null
    technicians?: {
      technician_id: string
      technician_name?: string | null
      contact_number?: string | null
    } | null
  }>
}

interface JobCompletionWizardProps {
  orderId: string
  snapshot?: LocalJobSnapshot
}

const STEPS = [
  { id: 1, label: 'Inspeksi AC', icon: Snowflake },
  { id: 2, label: 'Tanda Tangan', icon: PenLine },
  { id: 3, label: 'Jadwal & Catatan', icon: CalendarDays },
  { id: 4, label: 'Review', icon: ClipboardCheck },
] as const

function selectString(value: string | null | undefined): string {
  return value ?? ''
}

function normalizeMaterialSelects(materials: AcUnitReportItem['materials_used']): AcUnitReportItem['materials_used'] {
  return (materials ?? []).map((material) => ({
    ...material,
    category: selectString(material.category) || 'PARTS',
    unit_of_measure: selectString(material.unit_of_measure) || 'pcs',
  }))
}

function normalizeAcUnitSelects(unit: AcUnitReportItem): AcUnitReportItem {
  return {
    ...unit,
    brand_id: selectString(unit.brand_id),
    unit_type_id: selectString(unit.unit_type_id),
    capacity_id: selectString(unit.capacity_id),
    capacity_label: selectString(unit.capacity_label),
    materials_used: normalizeMaterialSelects(unit.materials_used),
  }
}

function snapshotToJobContext(snapshot: LocalJobSnapshot): JobContext {
  return {
    order_id: snapshot.orderId,
    status: snapshot.status,
    canonical_status: snapshot.status,
    has_report: false,
    report_id: null,
    scheduled_visit_date: snapshot.scheduledDate,
    customers: {
      customer_name: snapshot.customer.name,
    },
    order_items: snapshot.orderItems.map((item) => ({
      order_item_id: item.id,
      ac_unit_id: item.acUnitId,
      service_type: item.serviceType,
      quantity: 1,
      locations: {
        full_address: snapshot.customer.address,
      },
      ac_units: item.acUnit
        ? {
            ac_unit_id: item.acUnit.id ?? item.acUnitId ?? '',
            brand: item.acUnit.brand,
            brand_id: selectString(item.acUnit.brandId),
            model_number: item.acUnit.modelNumber,
            serial_number: item.acUnit.serialNumber,
            installation_date: item.acUnit.installationDate,
            ac_type: item.acUnit.acType,
            unit_type_id: selectString(item.acUnit.unitTypeId),
            capacity_id: selectString(item.acUnit.capacityId),
            room_location: item.acUnit.roomLocation,
            floor_level: item.acUnit.floorLevel,
            position_detail: item.acUnit.positionDetail,
            capacity_ranges: item.acUnit.capacityLabel
              ? { capacity_label: selectString(item.acUnit.capacityLabel) }
              : null,
          }
        : null,
    })),
    order_technicians: snapshot.technicianId
      ? [
          {
            id: snapshot.technicianId,
            technician_id: snapshot.technicianId,
            role: 'lead',
          },
        ]
      : [],
  }
}

export function JobCompletionWizard({ orderId, snapshot }: JobCompletionWizardProps) {
  const router = useRouter()
  const { toast } = useToast()

  // ---------------------------------------------------------------------------
  // Job context
  // ---------------------------------------------------------------------------
  const [jobData, setJobData] = useState<JobContext | null>(null)
  const [technicianId, setTechnicianId] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)
  const [missingOfflineSnapshot, setMissingOfflineSnapshot] = useState(false)

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [notes, setNotes] = useState('')
  const [nextServiceDate, setNextServiceDate] = useState<string>('')
  const [nextServiceNotes, setNextServiceNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [workStartedAt, setWorkStartedAt] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [acUnits, setAcUnits] = useState<AcUnitReportItem[]>([])
  const [initialAcUnits, setInitialAcUnits] = useState<AcUnitReportItem[]>([])
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)

  // Track photoIds from AcUnitForm for enqueueReport
  const acUnitPhotoIdsRef = useRef<string[]>([])

  // ---------------------------------------------------------------------------
  // Wizard state
  // ---------------------------------------------------------------------------
  const [currentStep, setCurrentStep] = useState(1)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]))
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({})
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const hasRestoredRef = useRef(false)

  const draftKey = `msn-erp-wizard-draft-${orderId}`

  // Calculate actualPrice automatically based on materials total sum
  const actualPrice = acUnits.reduce((sum, unit) => {
    if (unit.skipped) return sum
    return sum + (unit.materials_used || []).reduce((s, m) => s + m.total, 0)
  }, 0)

  const saveDraft = useCallback(() => {
    const draft = {
      customerNameSigned,
      notes,
      nextServiceDate,
      nextServiceNotes,
      workStartedAt,
      acUnits,
      currentStep,
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // localStorage quota exceeded or private mode — silently skip
    }
  }, [customerNameSigned, notes, nextServiceDate, nextServiceNotes, workStartedAt, acUnits, currentStep, draftKey])

  useEffect(() => {
    if (!draftReady) return
    saveDraft()
  }, [draftReady, saveDraft])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.customerNameSigned !== undefined) setCustomerNameSigned(draft.customerNameSigned)
        if (draft.notes !== undefined) setNotes(draft.notes)
        if (draft.nextServiceDate !== undefined) setNextServiceDate(draft.nextServiceDate)
        if (draft.nextServiceNotes !== undefined) setNextServiceNotes(draft.nextServiceNotes)
        if (draft.workStartedAt !== undefined) setWorkStartedAt(draft.workStartedAt)
        if (draft.acUnits !== undefined && Array.isArray(draft.acUnits)) {
          setAcUnits(draft.acUnits.map(normalizeAcUnitSelects))
        }
        if (draft.currentStep !== undefined) {
          setCurrentStep(draft.currentStep)
          setVisitedSteps(new Set([...Array.from({ length: draft.currentStep }, (_, i) => i + 1)]))
        }
        hasRestoredRef.current = true
        setDraftRestored(true)
      }
    } catch {
      // corrupted draft — silently skip
    } finally {
      setDraftReady(true)
    }
  }, [draftKey])

  useEffect(() => {
    if (!workStartedAt) return
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [workStartedAt])

  // ---------------------------------------------------------------------------
  // Fetch job context
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function applyJobContext(jobContext: JobContext, options: { hydrateOnly?: boolean } = {}) {
      setJobData(jobContext)

      if (!hasRestoredRef.current && !options.hydrateOnly) {
        setCustomerNameSigned(jobContext.customers?.customer_name || '')
      }

      const units: AcUnitReportItem[] = []
      if (jobContext.order_items && Array.isArray(jobContext.order_items)) {
        jobContext.order_items.forEach((item) => {
          if (item.ac_unit_id) {
            const acUnitData = item.ac_units
            const rawCapRange = acUnitData?.capacity_ranges
            const capLabel = rawCapRange
              ? (Array.isArray(rawCapRange)
                  ? rawCapRange[0]?.capacity_label
                  : rawCapRange.capacity_label)
              : null

            units.push({
              ac_unit_id: item.ac_unit_id,
              brand: acUnitData?.brand || '',
              brand_id: selectString(acUnitData?.brand_id),
              ac_type: acUnitData?.ac_type || '',
              unit_type_id: selectString(acUnitData?.unit_type_id),
              capacity_id: selectString(acUnitData?.capacity_id),
              capacity_label: selectString(capLabel),
              model_number: acUnitData?.model_number || '',
              serial_number: acUnitData?.serial_number || '',
              room_location: acUnitData?.room_location || '',
              floor_level: acUnitData?.floor_level || '',
              position_detail: acUnitData?.position_detail || '',
              skipped: false,
              skip_reason: '',
              photos_before: [],
              photos_after: [],
              notes: '',
              materials_used: [],
            })
          } else {
            const qty = item.quantity || 1
            for (let i = 0; i < qty; i++) {
              units.push({
                ac_unit_id: '',
                brand: '',
                brand_id: '',
                ac_type: '',
                unit_type_id: '',
                capacity_id: '',
                capacity_label: '',
                model_number: '',
                serial_number: '',
                room_location: '',
                floor_level: '',
                position_detail: '',
                skipped: false,
                skip_reason: '',
                photos_before: [],
                photos_after: [],
                notes: '',
                materials_used: [],
              })
            }
          }
        })
      }
      setInitialAcUnits(units)
      if (!hasRestoredRef.current && !options.hydrateOnly) {
        setAcUnits(units)
        const d = new Date()
        d.setMonth(d.getMonth() + 3)
        setNextServiceDate(d.toISOString().split('T')[0])
      }
    }

    async function fetchServerContext(hydrateOnly: boolean) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: techData } = await supabase
          .from('technicians')
          .select('technician_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (techData) {
          setTechnicianId(techData.technician_id)
        } else {
          setTechnicianId(user.id)
        }
      }

      const res = await fetch(`/api/technician/jobs/${encodeURIComponent(orderId)}`)
      if (!res.ok) throw new Error('Gagal memuat detail pekerjaan')

      const json = await res.json()
      if (!json.success || !json.data) throw new Error('Gagal memuat detail pekerjaan')

      applyJobContext(json.data as JobContext, { hydrateOnly })
    }

    async function fetchContext() {
      try {
        setMissingOfflineSnapshot(false)

        const localSnapshot = snapshot ?? (await getJobSnapshot(orderId).catch(() => undefined))
        if (localSnapshot) {
          applyJobContext(snapshotToJobContext(localSnapshot))
          if (localSnapshot.technicianId) setTechnicianId(localSnapshot.technicianId)
          setLoadingContext(false)
          window.setTimeout(() => {
            void fetchServerContext(true).catch((err) => {
              console.warn('Background job hydrate failed', err)
            })
          }, 0)
          return
        }

        await fetchServerContext(false)
      } catch (err) {
        console.error('Failed to fetch job context', err)
        setMissingOfflineSnapshot(true)
      } finally {
        setLoadingContext(false)
      }
    }
    fetchContext()
  }, [orderId, snapshot])

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  const validateStep = useCallback(
    (step: number): string[] => {
      const errors: string[] = []

      if (step === 1) {
        if (initialAcUnits.length === 0) {
          return errors
        }
        if (acUnits.length !== initialAcUnits.length) {
          errors.push(
            `Jumlah unit AC harus ${initialAcUnits.length} (sesuai order), saat ini ${acUnits.length}`
          )
          return errors
        }
        acUnits.forEach((unit, idx) => {
          const initialUnit = initialAcUnits[idx]
          const isExisting = !!unit.ac_unit_id
          const isExistingComplete = isExisting && !!(initialUnit?.brand_id && initialUnit?.unit_type_id && initialUnit?.capacity_id)

          if (unit.skipped) {
            if (!unit.skip_reason || unit.skip_reason.trim().length === 0) {
              errors.push(`AC ${idx + 1}: alasan tidak diservis wajib diisi`) 
            }
          } else {
            if (isExistingComplete) {
            } else if (isExisting) {
              if (!initialUnit?.brand_id && !unit.brand_id) {
                errors.push(`AC ${idx + 1}: merk wajib diisi`)
              }
              if (!initialUnit?.unit_type_id && !unit.unit_type_id) {
                errors.push(`AC ${idx + 1}: jenis AC wajib diisi`)
              }
              if (!initialUnit?.capacity_id && !unit.capacity_id) {
                errors.push(`AC ${idx + 1}: kapasitas wajib diisi`)
              }
            } else {
              if (!unit.brand_id) {
                errors.push(`AC ${idx + 1}: merk wajib dipilih`)
              }
              if (!unit.unit_type_id) {
                errors.push(`AC ${idx + 1}: jenis AC wajib dipilih`)
              }
              if (!unit.capacity_id) {
                errors.push(`AC ${idx + 1}: kapasitas wajib dipilih`)
              }
              if (!unit.room_location || unit.room_location.trim().length === 0) {
                errors.push(`AC ${idx + 1}: lokasi ruangan wajib diisi`)
              }
            }
            if (!unit.photos_before || unit.photos_before.length === 0) {
              errors.push(`AC ${idx + 1}: minimal 1 foto sebelum wajib diunggah`)
            }
            if (!unit.photos_after || unit.photos_after.length === 0) {
              errors.push(`AC ${idx + 1}: minimal 1 foto sesudah wajib diunggah`)
            }
          }
        })
      }

      if (step === 2) {
        if (!customerNameSigned || customerNameSigned.trim().length === 0) {
          errors.push('Nama penandatangan wajib diisi')
        }
        if (!signatureBlob) {
          errors.push('Tanda tangan pelanggan wajib diisi')
        }
      }

      if (step === 3) {
        // No price input validation required as actualPrice is auto-calculated
      }

      return errors
    },
    [acUnits, initialAcUnits, customerNameSigned, signatureBlob]
  )

  const getTimerPrecheckErrors = useCallback((): string[] => {
    const errors: string[] = []
    if (initialAcUnits.length === 0) return errors
    if (acUnits.length !== initialAcUnits.length) {
      errors.push('Lengkapi data AC')
      return errors
    }

    let needsBeforePhoto = false
    let needsAcDetails = false
    acUnits.forEach((unit, idx) => {
      if (unit.skipped) return
      const initialUnit = initialAcUnits[idx]
      const isExisting = !!unit.ac_unit_id
      const isExistingComplete = isExisting && !!(initialUnit?.brand_id && initialUnit?.unit_type_id && initialUnit?.capacity_id)

      if (!unit.photos_before || unit.photos_before.length === 0) {
        needsBeforePhoto = true
      }
      if (isExistingComplete) return
      if (!unit.brand_id || !unit.unit_type_id || !unit.capacity_id) {
        needsAcDetails = true
      }
      if (!isExisting && (!unit.room_location || unit.room_location.trim().length === 0)) {
        needsAcDetails = true
      }
    })

    if (needsBeforePhoto) errors.push('Harus upload foto sebelum')
    if (needsAcDetails) errors.push('Lengkapi data AC')
    return errors
  }, [acUnits, initialAcUnits])

  const timerPrecheckErrors = getTimerPrecheckErrors()
  const canStartWorkTimer = timerPrecheckErrors.length === 0
  const elapsedSeconds = workStartedAt
    ? Math.max(0, Math.floor((nowMs - new Date(workStartedAt).getTime()) / 1000))
    : 0

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function startWorkTimer() {
    if (!canStartWorkTimer || workStartedAt) return
    const startedAt = new Date().toISOString()
    setWorkStartedAt(startedAt)
    setNowMs(Date.now())
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const goToStep = useCallback(
    (step: number) => {
      if (step < currentStep) {
        setCurrentStep(step)
        setVisitedSteps((prev) => new Set(prev).add(step))
        setStepErrors((prev) => ({ ...prev, [currentStep]: [] }))
        return
      }

      if (step === currentStep + 1) {
        const errors = validateStep(currentStep)
        if (errors.length > 0) {
          setStepErrors((prev) => ({ ...prev, [currentStep]: errors }))
          toast({
            title: 'Data belum lengkap',
            description: errors[0],
            variant: 'destructive',
          })
          return
        }
        setStepErrors((prev) => ({ ...prev, [currentStep]: [] }))
        setCurrentStep(step)
        setVisitedSteps((prev) => new Set(prev).add(step))
      }
    },
    [currentStep, validateStep, toast]
  )

  const goNext = useCallback(() => {
    if (currentStep < 4) {
      goToStep(currentStep + 1)
    }
  }, [currentStep, goToStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
      setStepErrors((prev) => ({ ...prev, [currentStep]: [] }))
    }
  }, [currentStep])

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmitClick = () => {
    const allErrors: string[] = []
    for (let s = 1; s <= 3; s++) {
      allErrors.push(...validateStep(s))
    }
    if (allErrors.length > 0) {
      setStepErrors((prev) => ({ ...prev, 4: allErrors }))
      toast({
        title: 'Data belum lengkap',
        description: allErrors[0],
        variant: 'destructive',
      })
      return
    }
    setShowSubmitDialog(true)
  }

  const performSubmit = async () => {
    setShowSubmitDialog(false)
    setSubmitting(true)
    try {
      const idempotencyKey = newIdempotencyKey()
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

      photoIds.push(...acUnitPhotoIdsRef.current)

      const allMaterials = acUnits.flatMap((unit) => unit.materials_used || [])

      const mappedAcUnits = acUnits.map((unit) => ({
        ...unit,
        photos_before: [],
        photos_after: [],
      }))

      const workCompletedAt = new Date().toISOString()
      const workDurationMinutes = workStartedAt
        ? computeWorkDurationMinutes(workStartedAt, workCompletedAt)
        : undefined

      const payload: TechnicianReportPayload = {
        idempotency_key: idempotencyKey,
        photos_before: [],
        photos_after: [],
        materials: allMaterials,
        actual_total_price: actualPrice,
        customer_signature_url: '',
        customer_name_signed: customerNameSigned,
        notes: notes,
        work_started_at: workStartedAt,
        work_completed_at: workCompletedAt,
        work_duration_minutes: workDurationMinutes,
        next_service_recommendation_date: nextServiceDate || null,
        next_service_recommendation_notes: nextServiceNotes || null,
        ac_units: mappedAcUnits,
      }

      await enqueueReport({
        orderId,
        technicianId,
        payload,
        photoIds,
      })

      toast({
        title: 'Tersimpan',
        description: 'Laporan akan disinkronkan saat online',
      })

      try {
        localStorage.removeItem(draftKey)
      } catch {
        // silently skip
      }

      router.push('/technician')
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Gagal menyimpan laporan'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  if (loadingContext) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-mute" />
      </div>
    )
  }

  if (missingOfflineSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="mb-4 text-sm text-ink-mute">Tidak ada data offline untuk job ini</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-11">
          Coba Lagi
        </Button>
      </div>
    )
  }

  const customerName = jobData?.customers?.customer_name || 'Pelanggan'
  const locationAddress = jobData?.order_items?.[0]?.locations?.full_address || 'Tidak ada alamat'

  // ---------------------------------------------------------------------------
  // Step content renderers
  // ---------------------------------------------------------------------------
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <section className="space-y-4" data-testid="ac-units-section">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">
                Data Unit AC
                {initialAcUnits.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-ink-mute tabular-nums">
                    ({initialAcUnits.length})
                  </span>
                )}
              </h2>
              <p className="text-sm leading-5 text-slate-500">
                {initialAcUnits.length > 0
                  ? `Isi data untuk ${initialAcUnits.length} unit AC sesuai order. Tidak bisa tambah atau hapus.`
                  : 'Order ini tidak memiliki unit AC yang perlu diinspeksi.'}
              </p>
            </div>
            <AcUnitForm
              orderId={orderId}
              initialUnits={initialAcUnits}
              formUnits={acUnits}
              onChange={setAcUnits}
              onPhotoIdsChange={(ids) => {
                acUnitPhotoIdsRef.current = ids
              }}
            />
            <div className="rounded-2xl border border-hairline bg-slate-50/70 p-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-navy-deep">
                <Timer className="h-4 w-4" aria-hidden="true" />
                <span>Waktu Kerja</span>
              </div>
              <p className="text-2xl font-mono font-bold tabular-nums text-slate-950">
                {formatElapsed(elapsedSeconds)}
              </p>
              <Button
                type="button"
                className="mt-3 h-11 rounded-2xl"
                variant={workStartedAt ? 'outline' : 'default'}
                onClick={startWorkTimer}
                disabled={!canStartWorkTimer || !!workStartedAt}
              >
                {workStartedAt ? 'Timer Berjalan' : 'Mulai Waktu'}
              </Button>
              {timerPrecheckErrors.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-destructive">
                  {timerPrecheckErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )

      case 2:
        return (
          <section className="space-y-6" data-testid="signature-section">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">Tanda Tangan Pelanggan</h2>
              <p className="text-sm leading-5 text-slate-500">
                Minta pelanggan mengecek pekerjaan, lalu tanda tangani laporan.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerNameSigned">Nama Penandatangan</Label>
                <Input
                  id="customerNameSigned"
                  required
                  value={customerNameSigned}
                  onChange={(e) => setCustomerNameSigned(e.target.value)}
                  placeholder="Nama pelanggan yang bertanda tangan"
                />
              </div>

              <div className="space-y-2">
                <Label>Tanda Tangan</Label>
                <SignaturePad
                  onBlobChange={setSignatureBlob}
                  onChange={setSignatureDataUrl}
                  value={signatureDataUrl || undefined}
                />
              </div>
            </div>
          </section>
        )

      case 3:
        return (
          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">Jadwal &amp; Catatan</h2>
              <p className="text-sm leading-5 text-slate-500">
                Tambahkan catatan lapangan dan rekomendasi servis berikutnya.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Tambahan</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan pengerjaan (opsional)"
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextServiceDate">Rekomendasi Servis Berikutnya</Label>
                <Input
                  id="nextServiceDate"
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextServiceNotes">Catatan Servis Berikutnya</Label>
                <Input
                  id="nextServiceNotes"
                  value={nextServiceNotes}
                  onChange={(e) => setNextServiceNotes(e.target.value)}
                  placeholder="Misal: Cuci besar"
                />
              </div>
            </div>
          </section>
        )

      case 4:
        return (
          <section className="space-y-6" data-testid="review-section">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">Review Laporan</h2>
              <p className="text-sm leading-5 text-slate-500">
                Periksa kembali data, foto, tanda tangan, dan jadwal sebelum disimpan.
              </p>
            </div>

            {/* AC Units Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-ink-mute">
                Unit AC ({acUnits.length})
              </h3>
              <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-slate-50/70">
                {acUnits.map((unit, idx) => (
                  <div key={unit.ac_unit_id || idx} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        AC {idx + 1}: {unit.brand || 'Merk belum diisi'}
                      </span>
                      {unit.skipped ? (
                        <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                          Tidak diservis
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-status-completed bg-status-completed/10 px-2 py-0.5 rounded">
                          Diservis
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-ink-mute space-y-0.5">
                      {unit.room_location && <p>Lokasi: {unit.room_location}</p>}
                      {unit.floor_level && <p>Lantai: {unit.floor_level}</p>}
                      {unit.position_detail && <p>Posisi Detail: {unit.position_detail}</p>}
                      {unit.ac_type && <p>Tipe/Jenis AC: {unit.ac_type}</p>}
                      {unit.capacity_label && <p>Kapasitas: {unit.capacity_label}</p>}
                      {unit.skipped && unit.skip_reason && (
                        <p className="text-destructive">Alasan: {unit.skip_reason}</p>
                      )}
                      {!unit.skipped && (
                        <>
                          <p>Foto sebelum: {unit.photos_before?.length || 0} foto</p>
                          <p>Foto sesudah: {unit.photos_after?.length || 0} foto</p>
                          {unit.materials_used && unit.materials_used.length > 0 && (
                            <div className="mt-1 pt-1 border-t text-xs">
                              <p className="font-medium text-ink-mute">Material yang digunakan:</p>
                              <ul className="list-disc list-inside space-y-0.5 mt-1">
                                {unit.materials_used.map((mat, mIdx) => (
                                  <li key={mIdx}>
                                    {mat.name} x{mat.qty} {mat.is_manual ? '(Proposed)' : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {unit.notes && <p>Catatan AC: {unit.notes}</p>}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Signature Summary */}
            <div className="space-y-3 rounded-2xl border border-hairline bg-slate-50/70 p-4">
              <h3 className="text-sm font-medium text-ink-mute uppercase tracking-wide">
                Tanda Tangan
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-ink-mute">Nama:</span>{' '}
                  <span className="font-medium">{customerNameSigned || '-'}</span>
                </p>
                <p>
                  <span className="text-ink-mute">Tanda tangan:</span>{' '}
                  {signatureBlob ? (
                    <span className="font-medium text-status-completed">Sudah ditandatangani</span>
                  ) : (
                    <span className="text-destructive">Belum ditandatangani</span>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            {/* Schedule & Cost Summary */}
            <div className="space-y-3 rounded-2xl border border-hairline bg-slate-50/70 p-4">
              <h3 className="text-sm font-medium text-ink-mute uppercase tracking-wide">
                Ringkasan Biaya &amp; Jadwal
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-ink-mute">Total Biaya (Terhitung):</span>{' '}
                  <span className="font-bold text-primary">
                    Rp {actualPrice.toLocaleString('id-ID')}
                  </span>
                </p>
                {notes && (
                  <p>
                    <span className="text-ink-mute">Catatan Laporan:</span> {notes}
                  </p>
                )}
                {nextServiceDate && (
                  <p>
                    <span className="text-ink-mute">Servis berikutnya:</span>{' '}
                    {new Date(nextServiceDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
                {nextServiceNotes && (
                  <p>
                    <span className="text-ink-mute">Catatan servis:</span>{' '}
                    {nextServiceNotes}
                  </p>
                )}
              </div>
            </div>

            {/* Validation errors on review step */}
            {stepErrors[4] && stepErrors[4].length > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Data belum lengkap:</span>
                </div>
                <ul className="list-disc list-inside text-sm text-destructive space-y-0.5">
                  {stepErrors[4].map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )

      default:
        return null
    }
  }

  return (
    <div className="-mx-4 -my-4 min-h-dvh bg-slate-50 pb-28">
      <header className="rounded-b-[40px] bg-navy-deep px-4 pb-16 pt-4 text-white shadow-sm">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="h-10 rounded-full bg-white/10 px-3 text-white hover:bg-white/15 hover:text-white" asChild>
              <Link href={`/technician/job/${orderId}`}>
                <ArrowLeft className="h-4 w-4" />
                <span className="ml-1">Kembali</span>
              </Link>
            </Button>
            <SyncStatus variant="full" className="text-white" data-testid="sync-status-badge" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
              Laporan teknisi
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Penyelesaian Pekerjaan</h1>
            <p className="max-w-xl text-sm leading-6 text-white/75">
              Selesaikan pesanan untuk <strong className="text-white">{customerName}</strong> di {locationAddress}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-10 max-w-2xl space-y-4 px-4">
        {draftRestored && (
          <div className="flex items-start gap-3 rounded-2xl border border-navy-deep/10 bg-white p-4 text-sm text-navy-deep shadow-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Draft dipulihkan</p>
              <p className="mt-0.5 text-slate-500">Data sebelumnya otomatis dimuat dari perangkat ini.</p>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="rounded-3xl border border-hairline bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Langkah {currentStep} dari {STEPS.length}</span>
            <span>{STEPS[currentStep - 1]?.label}</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-navy-deep transition-all duration-300"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STEPS.map((step) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = step.id < currentStep
            const isClickable = step.id <= Math.max(...Array.from(visitedSteps)) || step.id === currentStep

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && goToStep(step.id)}
                className={cn(
                  'flex min-w-[max-content] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-deep focus-visible:ring-offset-2',
                  isActive && 'border-navy-deep bg-navy-deep text-white shadow-sm',
                  isCompleted && !isActive && 'border-navy-deep/20 bg-navy-deep/5 text-navy-deep',
                  !isActive && !isCompleted && 'border-slate-200 bg-slate-50 text-slate-500',
                  !isClickable && 'cursor-default'
                )}
                disabled={!isClickable}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                    isActive && 'bg-white text-navy-deep',
                    isCompleted && !isActive && 'bg-navy-deep text-white',
                    !isActive && !isCompleted && 'bg-white text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  {...(isActive ? { 'data-testid': 'wizard-active-step' } : {})}
                  className={cn(
                    'text-xs leading-4 transition-colors duration-200',
                    isActive ? 'text-navy-deep font-bold' : 'font-semibold'
                  )}
                >
                  {step.label}
                </span>
              </button>
            )
          })}
          </div>
        </div>

      {/* Step content */}
      <div 
        key={currentStep} // Forces re-render for animation on step change
        className="min-h-[300px] animate-in rounded-3xl border border-hairline bg-white p-4 shadow-sm fade-in slide-in-from-bottom-2 duration-300 sm:p-5"
      >
        {renderStepContent()}
      </div>

      {/* Step errors (non-review steps) */}
      {stepErrors[currentStep] && stepErrors[currentStep].length > 0 && currentStep !== 4 && (
        <div className="space-y-2 rounded-2xl border border-destructive/20 bg-white p-4 text-destructive shadow-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Perbaiki data berikut:</span>
          </div>
          <ul className="list-disc list-inside text-sm text-destructive space-y-0.5">
            {stepErrors[currentStep].map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation buttons */}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur safe-area-pb">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl transition-all duration-200 active:scale-[0.98]"
              onClick={goBack}
              disabled={submitting}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Sebelumnya
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              className={cn('h-12 rounded-2xl bg-navy-deep text-white hover:bg-navy-light', currentStep === 1 ? 'w-full' : 'flex-1')}
              onClick={goNext}
              disabled={submitting}
            >
              Selanjutnya
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl bg-navy-deep text-white hover:bg-navy-light"
              size="lg"
              disabled={submitting}
              onClick={handleSubmitClick}
              data-testid="submit-button"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">
              Selesaikan Pekerjaan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Pastikan semua data, foto, dan tanda tangan pelanggan sudah benar. Laporan yang sudah disimpan akan dikirim ke sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel className="flex-1 sm:flex-none sm:min-w-[140px]">Periksa Lagi</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                performSubmit()
              }}
              disabled={submitting}
              className="flex-1 sm:flex-none sm:min-w-[140px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Ya, Simpan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
