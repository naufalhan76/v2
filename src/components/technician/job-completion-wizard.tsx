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
import { createAddonRequest } from '@/lib/actions/addon-requests'

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
}

const STEPS = [
  { id: 1, label: 'Inspeksi AC', icon: Snowflake },
  { id: 2, label: 'Tanda Tangan', icon: PenLine },
  { id: 3, label: 'Jadwal & Catatan', icon: CalendarDays },
  { id: 4, label: 'Review', icon: ClipboardCheck },
] as const

export function JobCompletionWizard({ orderId }: JobCompletionWizardProps) {
  const router = useRouter()
  const { toast } = useToast()

  // ---------------------------------------------------------------------------
  // Job context
  // ---------------------------------------------------------------------------
  const [jobData, setJobData] = useState<JobContext | null>(null)
  const [technicianId, setTechnicianId] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [notes, setNotes] = useState('')
  const [nextServiceDate, setNextServiceDate] = useState<string>('')
  const [nextServiceNotes, setNextServiceNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      acUnits,
      currentStep,
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // localStorage quota exceeded or private mode — silently skip
    }
  }, [customerNameSigned, notes, nextServiceDate, nextServiceNotes, acUnits, currentStep, draftKey])

  useEffect(() => {
    const timer = setTimeout(saveDraft, 3000)
    return () => clearTimeout(timer)
  }, [saveDraft])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.customerNameSigned !== undefined) setCustomerNameSigned(draft.customerNameSigned)
        if (draft.notes !== undefined) setNotes(draft.notes)
        if (draft.nextServiceDate !== undefined) setNextServiceDate(draft.nextServiceDate)
        if (draft.nextServiceNotes !== undefined) setNextServiceNotes(draft.nextServiceNotes)
        if (draft.acUnits !== undefined && Array.isArray(draft.acUnits)) setAcUnits(draft.acUnits)
        if (draft.currentStep !== undefined) {
          setCurrentStep(draft.currentStep)
          setVisitedSteps(new Set([...Array.from({ length: draft.currentStep }, (_, i) => i + 1)]))
        }
      }
    } catch {
      // corrupted draft — silently skip
    }
  }, [draftKey])

  // ---------------------------------------------------------------------------
  // Fetch job context
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchContext() {
      try {
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
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data) {
            const jobContext = json.data as JobContext
            setJobData(jobContext)
            setCustomerNameSigned(jobContext.customers?.customer_name || '')

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
                    brand_id: acUnitData?.brand_id || null,
                    ac_type: acUnitData?.ac_type || '',
                    unit_type_id: acUnitData?.unit_type_id || null,
                    capacity_id: acUnitData?.capacity_id || null,
                    capacity_label: capLabel || null,
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
                }
              })
            }
            setInitialAcUnits(units)
            setAcUnits(units)

            const d = new Date()
            d.setMonth(d.getMonth() + 3)
            setNextServiceDate(d.toISOString().split('T')[0])
          }
        }
      } catch (err) {
        console.error('Failed to fetch job context', err)
      } finally {
        setLoadingContext(false)
      }
    }
    fetchContext()
  }, [orderId])

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
          if (unit.skipped) {
            if (!unit.skip_reason || unit.skip_reason.trim().length === 0) {
              errors.push(`AC ${idx + 1}: alasan tidak diservis wajib diisi`)
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
    [acUnits, initialAcUnits.length, customerNameSigned, signatureBlob]
  )

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

      // Auto-submit addon requests for manual materials
      const manualMaterials = allMaterials.filter((m) => !m.addon_id && m.is_manual)
      for (const mat of manualMaterials) {
        try {
          await createAddonRequest({
            category: mat.category || 'PARTS',
            item_name: mat.name,
            unit_of_measure: mat.unit_of_measure || 'pcs',
            proposed_unit_price: mat.unit_price,
            description: mat.description || `Auto-submitted dari order ${orderId}`,
          })
        } catch (err) {
          console.error('Failed to auto-submit addon request:', err)
        }
      }

      const mappedAcUnits = acUnits.map((unit) => ({
        ...unit,
        photos_before: [],
        photos_after: [],
      }))

      const payload: TechnicianReportPayload = {
        idempotency_key: idempotencyKey,
        photos_before: [],
        photos_after: [],
        materials: allMaterials,
        actual_total_price: actualPrice,
        customer_signature_url: '',
        customer_name_signed: customerNameSigned,
        notes: notes,
        work_started_at: null,
        work_completed_at: new Date().toISOString(),
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <h2 className="text-lg font-semibold">
                Data Unit AC
                {initialAcUnits.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                    ({initialAcUnits.length})
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {initialAcUnits.length > 0
                  ? `Isi data untuk ${initialAcUnits.length} unit AC sesuai order. Tidak bisa tambah atau hapus.`
                  : 'Order ini tidak memiliki unit AC yang perlu diinspeksi.'}
              </p>
            </div>
            <AcUnitForm
              orderId={orderId}
              initialUnits={initialAcUnits}
              onChange={setAcUnits}
              onPhotoIdsChange={(ids) => {
                acUnitPhotoIdsRef.current = ids
              }}
            />
          </section>
        )

      case 2:
        return (
          <section className="space-y-6" data-testid="signature-section">
            <h2 className="text-lg font-semibold">Tanda Tangan Pelanggan</h2>
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
            <h2 className="text-lg font-semibold">Jadwal &amp; Catatan</h2>

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
            <h2 className="text-lg font-semibold">Review Laporan</h2>

            {/* AC Units Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Unit AC ({acUnits.length})
              </h3>
              <div className="rounded-lg border border-border/60 divide-y divide-border/60">
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
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          Diservis
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
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
                              <p className="font-medium text-muted-foreground">Material yang digunakan:</p>
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
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Tanda Tangan
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Nama:</span>{' '}
                  <span className="font-medium">{customerNameSigned || '-'}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Tanda tangan:</span>{' '}
                  {signatureBlob ? (
                    <span className="font-medium text-emerald-600">Sudah ditandatangani</span>
                  ) : (
                    <span className="text-destructive">Belum ditandatangani</span>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            {/* Schedule & Cost Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Ringkasan Biaya &amp; Jadwal
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Total Biaya (Terhitung):</span>{' '}
                  <span className="font-bold text-primary">
                    Rp {actualPrice.toLocaleString('id-ID')}
                  </span>
                </p>
                {notes && (
                  <p>
                    <span className="text-muted-foreground">Catatan Laporan:</span> {notes}
                  </p>
                )}
                {nextServiceDate && (
                  <p>
                    <span className="text-muted-foreground">Servis berikutnya:</span>{' '}
                    {new Date(nextServiceDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
                {nextServiceNotes && (
                  <p>
                    <span className="text-muted-foreground">Catatan servis:</span>{' '}
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
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/technician/job/${orderId}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Link>
        <SyncStatus variant="full" className="mb-4" data-testid="sync-status-badge" />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Penyelesaian Pekerjaan</h1>
        <p className="text-muted-foreground">
          Selesaikan pesanan untuk <strong>{customerName}</strong> di {locationAddress}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
        {/* Progress bar fill */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        <div className="relative flex justify-between">
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
                  'flex flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg p-1',
                  !isClickable && 'cursor-default'
                )}
                disabled={!isClickable}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'border-muted bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium transition-colors duration-200',
                    isActive && 'text-foreground',
                    isCompleted && 'text-primary',
                    !isActive && !isCompleted && 'text-muted-foreground'
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
        className="min-h-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {renderStepContent()}
      </div>

      {/* Step errors (non-review steps) */}
      {stepErrors[currentStep] && stepErrors[currentStep].length > 0 && currentStep !== 4 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-2">
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
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 transition-all duration-200 active:scale-[0.98]"
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
              className={cn('h-12', currentStep === 1 ? 'w-full' : 'flex-1')}
              onClick={goNext}
              disabled={submitting}
            >
              Selanjutnya
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 h-12"
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
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
