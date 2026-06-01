'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase-browser'
import { enqueueReport, enqueuePhoto, newIdempotencyKey } from '@/lib/offline/sync-manager'
import type { TechnicianReportPayload, AcUnitReportItem } from '@/app/api/schemas/technician'
import { useToast } from '@/hooks/use-toast'
import { AcUnitForm } from '@/components/technician/ac-unit-form'
import { SignaturePad } from '@/components/technician/signature-pad'
import { SyncStatus } from '@/components/technician/sync-status'

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
    // ac_unit_id is the FK on order_items; included when Supabase resolves the relation
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
      model_number?: string | null
      serial_number?: string | null
      installation_date?: string | null
      // Fields not in the current DB select but accessed with || '' fallback
      ac_type?: string | null
      capacity_pk?: string | null
      room_location?: string | null
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

interface CompleteJobFormV2Props {
  orderId: string
}

export function CompleteJobFormV2({ orderId }: CompleteJobFormV2Props) {
  const router = useRouter()
  const { toast } = useToast()
  
  // Job context
  const [jobData, setJobData] = useState<JobContext | null>(null)
  const [technicianId, setTechnicianId] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)

  const [actualPrice, setActualPrice] = useState<number>(0)
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [notes, setNotes] = useState('')
  const [nextServiceDate, setNextServiceDate] = useState<string>('')
  const [nextServiceNotes, setNextServiceNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // New T3 & T5 states
  const [acUnits, setAcUnits] = useState<AcUnitReportItem[]>([])
  const [initialAcUnits, setInitialAcUnits] = useState<AcUnitReportItem[]>([])
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)

  // Track photoIds from AcUnitForm for enqueueReport
  const acUnitPhotoIdsRef = useRef<string[]>([])

  useEffect(() => {
    async function fetchContext() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Resolve technician_id from user's auth_user_id
          const { data: techData } = await supabase
            .from('technicians')
            .select('technician_id')
            .eq('auth_user_id', user.id)
            .maybeSingle()
          
          if (techData) {
            setTechnicianId(techData.technician_id)
          } else {
            // fallback if not found
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
            
            // Map existing AC units from order items if available
            const units: AcUnitReportItem[] = []
            if (jobContext.order_items && Array.isArray(jobContext.order_items)) {
              jobContext.order_items.forEach((item) => {
                if (item.ac_unit_id) {
                  const acUnitData = item.ac_units
                  units.push({
                    ac_unit_id: item.ac_unit_id,
                    brand: acUnitData?.brand || '',
                    ac_type: acUnitData?.ac_type || '',
                    model_number: acUnitData?.model_number || '',
                    serial_number: acUnitData?.serial_number || '',
                    capacity_pk: acUnitData?.capacity_pk || '',
                    room_location: acUnitData?.room_location || '',
                    skipped: false,
                    skip_reason: '',
                    photos_before: [],
                    photos_after: [],
                    notes: '',
                    materials_used: []
                  })
                }
              })
            }
            setInitialAcUnits(units)
            setAcUnits(units)

            // Default next service date to 3 months from now
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const idempotencyKey = newIdempotencyKey()
      const photoIds: string[] = []

      // Enqueue signature blob
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

      // Include all AC unit photo IDs (already enqueued by PhotoUploadOffline)
      photoIds.push(...acUnitPhotoIdsRef.current)

      // Aggregate materials from all AC units
      const allMaterials = acUnits.flatMap(unit => unit.materials_used || [])

      // Photos will be patched by sync-manager at drain time using photoIds metadata
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
        ac_units: mappedAcUnits
      }

      await enqueueReport({
        orderId,
        technicianId,
        payload,
        photoIds
      })

      toast({
        title: 'Tersimpan',
        description: 'Laporan akan disinkronkan saat online',
      })

      router.push('/technician')
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Error',
        description: err.message || 'Gagal menyimpan laporan',
        variant: 'destructive',
      })
      setSubmitting(false)
    }
  }

  if (loadingContext) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const customerName = jobData?.customers?.customer_name || 'Pelanggan'
  const locationAddress = jobData?.order_items?.[0]?.locations?.full_address || 'Tidak ada alamat'

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
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

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4" data-testid="ac-units-section">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Data Unit AC</h2>
          </div>
          <AcUnitForm
            orderId={orderId}
            initialUnits={initialAcUnits}
            onChange={setAcUnits}
            onPhotoIdsChange={(ids) => { acUnitPhotoIdsRef.current = ids }}
          />
        </section>

        <Separator />

        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Rincian Pekerjaan</h2>

          <div className="space-y-2">
            <Label htmlFor="actualPrice">Total Biaya Aktual (Rp)</Label>
            <Input
              id="actualPrice"
              type="number"
              min="0"
              required
              value={actualPrice === 0 ? '' : actualPrice}
              onChange={(e) => setActualPrice(Number(e.target.value))}
              placeholder="Contoh: 150000"
            />
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

        <Separator />

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
              <SignaturePad onBlobChange={setSignatureBlob} onChange={setSignatureDataUrl} value={signatureDataUrl || undefined} />
            </div>
          </div>
        </section>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting}
          data-testid="submit-button"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
        </Button>
      </form>
    </div>
  )
}
