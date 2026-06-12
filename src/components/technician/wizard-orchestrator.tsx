'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'

import { WizardPhaseA, type AcUnitData, type PhaseADraft } from './wizard-phase-a'
import { WizardPhaseB } from './wizard-phase-b'
import { WizardPhaseC } from './wizard-phase-c'
import { createClient } from '@/lib/supabase-browser'
import { getJobSnapshot, type LocalJobSnapshot } from '@/lib/offline/snapshot'
import { useToast } from '@/hooks/use-toast'
import type { AcUnitReportItem } from '@/app/api/schemas/technician'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Matches the internal JobSummary type in wizard-phase-b.tsx
type JobSummary = {
  customerName: string
  address: string
  serviceType: string
}

// Matches JobContext in job-completion-wizard.tsx (fetch logic, lines 49-106)
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

export interface WizardOrchestratorProps {
  orderId: string
  snapshot?: LocalJobSnapshot
}

type Phase = 'A' | 'B' | 'C' | 'done'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function selectString(value: string | null | undefined): string {
  return value ?? ''
}

// Extract AC units from order_items — replicates old wizard lines 310-368
function extractAcUnits(jobContext: JobContext): AcUnitReportItem[] {
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

  return units
}

// Convert a LocalJobSnapshot to JobContext — replicates old wizard lines 143-192
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

// Build JobSummary for Phase B from fetched job context
function buildJobSummary(jobData: JobContext): JobSummary {
  const customerName = jobData.customers?.customer_name || 'Pelanggan'
  const address = jobData.order_items?.[0]?.locations?.full_address || 'Tidak ada alamat'
  const serviceTypes = jobData.order_items
    ?.map((item) => item.service_type)
    .filter((t): t is string => Boolean(t))
  const serviceType = serviceTypes?.[0] || 'Servis AC'

  return { customerName, address, serviceType }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardOrchestrator({ orderId, snapshot }: WizardOrchestratorProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [jobData, setJobData] = useState<JobContext | null>(null)
  const [technicianId, setTechnicianId] = useState<string>('')
  const [loadingContext, setLoadingContext] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('A')
  const [phaseADraft, setPhaseADraft] = useState<PhaseADraft | null>(null)

  // Fetch job context — replicates old wizard lines 300-430
  useEffect(() => {
    let mounted = true

    async function fetchServerContext(hydrateOnly: boolean) {
      if (!mounted) return
      const res = await fetch(`/api/technician/jobs/${encodeURIComponent(orderId)}`)
      if (!res.ok) throw new Error('Gagal memuat detail pekerjaan')

      const json = await res.json()
      if (!json.success || !json.data) throw new Error('Gagal memuat detail pekerjaan')

      setJobData(json.data as JobContext)
    }

    async function fetchContext() {
      try {
        const localSnapshot = snapshot ?? (await getJobSnapshot(orderId).catch(() => undefined))

        if (localSnapshot) {
          const ctx = snapshotToJobContext(localSnapshot)
          setJobData(ctx)
          if (localSnapshot.technicianId) setTechnicianId(localSnapshot.technicianId)
          setLoadingContext(false)

          // Background hydrate from server
          void fetchServerContext(true).catch((err) => {
            console.warn('Background job hydrate failed', err)
          })
          return
        }

        // Fetch auth + server context
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
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

        await fetchServerContext(false)
      } catch (err) {
        console.error('Failed to fetch job context', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data pekerjaan')
        }
      } finally {
        if (mounted) {
          setLoadingContext(false)
        }
      }
    }

    void fetchContext()

    return () => {
      mounted = false
    }
  }, [orderId, snapshot])

  // Loading skeleton
  if (loadingContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0f1024]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1A1C4E]" />
      </div>
    )
  }

  // Error state
  if (error || !jobData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-5 dark:bg-[#0f1024]">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="mb-2 text-center text-sm font-medium text-slate-900 dark:text-white">
          {error || 'Data pekerjaan tidak ditemukan'}
        </p>
        <p className="mb-4 text-sm text-slate-500 dark:text-gray-400">
          Tidak dapat memuat detail pekerjaan
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-[#1A1C4E] bg-white px-6 py-3 text-sm font-bold text-[#1A1C4E] dark:border-indigo-400 dark:bg-[#252243] dark:text-white"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  const acUnits = extractAcUnits(jobData)
  const jobSummary = buildJobSummary(jobData)

  // Phase routing
  switch (phase) {
    case 'A':
      return (
        <WizardPhaseA
          orderId={orderId}
          acUnits={acUnits as AcUnitData[]}
          onComplete={(draft: PhaseADraft) => {
            setPhaseADraft(draft)
            setPhase('B')
          }}
        />
      )

    case 'B':
      return (
        <WizardPhaseB
          orderId={orderId}
          jobSummary={jobSummary}
          onComplete={() => setPhase('C')}
        />
      )

    case 'C': {
      if (!phaseADraft) {
        setPhase('A')
        return null
      }
      return (
        <WizardPhaseC
          orderId={orderId}
          phaseADraft={phaseADraft}
          technicianId={technicianId}
          onComplete={() => {
            toast({
              title: 'Tersimpan',
              description: 'Laporan akan disinkronkan saat online',
            })
            router.push('/technician')
          }}
        />
      )
    }

    default:
      return null
  }
}
