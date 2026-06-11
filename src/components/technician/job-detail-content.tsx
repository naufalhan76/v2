'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Phone, User, Wrench, FileText, Timer, Camera, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/orders/status-badge'
import { JobDetailSkeleton } from './job-detail-skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhotoUpload } from '@/components/technician/photo-upload'
import { useState, useEffect } from 'react'
import type { OrderStatus } from '@/lib/order-status'
import { captureGps } from '@/lib/utils/geolocation'
import type { GpsResult } from '@/lib/utils/geolocation'
import { jobToSnapshot, lockJobSnapshot, saveJobSnapshot } from '@/lib/offline/snapshot'

interface JobDetailContentProps {
  orderId: string
}

async function fetchJobDetail(orderId: string) {
  const res = await fetch(`/api/technician/jobs/${encodeURIComponent(orderId)}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Gagal memuat detail pekerjaan')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Gagal memuat data')
  return json.data
}

type TransitionPayload = {
  to_status: string
  idempotency_key: string
  gps: GpsResult
  arrival_photos?: string[]
}

async function buildTransitionPayload(toStatus: string, arrivalPhotos?: string[]): Promise<TransitionPayload> {
  const gps = await captureGps({ timeoutMs: 5_000 })
  return {
    to_status: toStatus,
    idempotency_key: crypto.randomUUID(),
    gps,
    arrival_photos: arrivalPhotos,
  }
}

async function transitionJob(orderId: string, payload: TransitionPayload) {
  const res = await fetch(`/api/technician/jobs/${encodeURIComponent(orderId)}/transition`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const json = await res.json()
    throw new Error(json.error || 'Gagal mengubah status')
  }
  return res.json()
}

export function JobDetailContent({ orderId }: JobDetailContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [workTimer, setWorkTimer] = useState<number>(0)
  const [showArrivalModal, setShowArrivalModal] = useState(false)
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([])

  const { data: job, isLoading, isError, error } = useQuery({
    queryKey: ['technician', 'job', orderId],
    queryFn: () => fetchJobDetail(orderId),
    staleTime: 30_000,
  })

  const transitionMutation = useMutation({
    mutationFn: async (params: { toStatus: string; arrivalPhotos?: string[] }) => {
      await lockJobSnapshot(orderId)
      const payload = await buildTransitionPayload(params.toStatus, params.arrivalPhotos)
      return transitionJob(orderId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician', 'job', orderId] })
      queryClient.invalidateQueries({ queryKey: ['technician', 'jobs', 'today'] })
    },
  })

  useEffect(() => {
    if (!job) return
    const snapshot = jobToSnapshot(job)
    if (!snapshot) return
    void saveJobSnapshot(snapshot).catch((err) => {
      console.warn('Failed to cache job detail snapshot', err)
    })
  }, [job])

  // Work timer for IN_PROGRESS state
  useEffect(() => {
    if (job?.canonical_status === 'IN_PROGRESS') {
      const interval = setInterval(() => {
        setWorkTimer((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setWorkTimer(0)
    }
  }, [job?.canonical_status])

  if (isLoading) return <JobDetailSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive mb-4">
          {error instanceof Error ? error.message : 'Terjadi kesalahan'}
        </p>
        <Button variant="outline" onClick={() => router.back()} className="h-11">
          Kembali
        </Button>
      </div>
    )
  }

  if (!job) return null

  const canonicalStatus: OrderStatus = job.canonical_status
  const customer = job.customers
  const orderItem = job.order_items?.[0]
  const location = orderItem?.locations
  const acUnit = orderItem?.ac_units
  const scheduledTime = new Date(job.scheduled_visit_date).toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  function formatTimer(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Back button + status */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="rounded-md" asChild>
          <Link href="/technician">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1">Kembali</span>
          </Link>
        </Button>
        <StatusBadge status={job.status} />
      </div>

      {/* Customer info card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-3">
        <h2 className="font-semibold text-lg text-balance">{customer?.customer_name ?? 'Customer'}</h2>

        {customer?.primary_contact_person && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
            <span>{customer.primary_contact_person}</span>
          </div>
        )}

        {customer?.phone_number && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
            <a
              href={`tel:${customer.phone_number}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {customer.phone_number}
            </a>
          </div>
        )}

        {location && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-ink-mute shrink-0 mt-0.5" aria-hidden="true" />
            <span>{location.full_address}{location.city ? `, ${location.city}` : ''}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
          <span>{scheduledTime}</span>
        </div>
      </div>

      {/* Service info card */}
      <div className="rounded-lg border border-hairline bg-background p-4 space-y-3">
        <h3 className="font-medium text-sm text-ink-mute uppercase tracking-wide">
          Detail Layanan
        </h3>

        <div className="flex items-center gap-2 text-sm">
          <Wrench className="h-4 w-4 text-ink-mute shrink-0" aria-hidden="true" />
          <span className="font-medium">{orderItem?.service_type ?? '-'}</span>
        </div>

        {acUnit && (
          <div className="text-sm space-y-1 pl-6">
            <p><span className="text-ink-mute">Merk:</span> {acUnit.brand ?? '-'}</p>
            <p><span className="text-ink-mute">Model:</span> {acUnit.model_number ?? '-'}</p>
            {acUnit.serial_number && (
              <p><span className="text-ink-mute">S/N:</span> {acUnit.serial_number}</p>
            )}
          </div>
        )}

        {orderItem?.description && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="h-4 w-4 text-ink-mute shrink-0 mt-0.5" aria-hidden="true" />
            <span>{orderItem.description}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {job.notes && (
        <div className="rounded-lg border border-hairline bg-background p-4">
          <h3 className="font-medium text-sm text-ink-mute uppercase tracking-wide mb-2">
            Catatan
          </h3>
          <p className="text-sm text-pretty whitespace-pre-wrap leading-relaxed">{job.notes}</p>
        </div>
      )}

      {/* Work timer (IN_PROGRESS only) */}
      {canonicalStatus === 'IN_PROGRESS' && (
        <div className="rounded-lg border border-violet-soft/30 bg-canvas-soft dark:border-violet-soft/20 dark:bg-violet-soft/10 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Timer className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-primary">
              Waktu Kerja
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground tabular-nums tracking-tight">
            {formatTimer(workTimer)}
          </p>
        </div>
      )}

      {/* Action buttons — state-aware */}
      <div className="pt-2 pb-4">
        {canonicalStatus === 'ASSIGNED' && (
          <Button
            onClick={() => transitionMutation.mutate({ toStatus: 'EN_ROUTE' })}
            disabled={transitionMutation.isPending}
            className="w-full h-12 text-base font-medium transition-all duration-200 active:scale-[0.98]"
            size="lg"
          >
            {transitionMutation.isPending ? 'Memproses...' : 'Berangkat'}
          </Button>
        )}

        {canonicalStatus === 'EN_ROUTE' && (
          <Button
            onClick={() => setShowArrivalModal(true)}
            disabled={transitionMutation.isPending}
            className="w-full h-12 text-base font-medium transition-all duration-200 active:scale-[0.98]"
            size="lg"
          >
            {transitionMutation.isPending ? 'Memproses...' : 'Mulai Kerja'}
          </Button>
        )}

        {canonicalStatus === 'IN_PROGRESS' && (
          <Button
              onClick={() => {
                void lockJobSnapshot(orderId).finally(() => {
                  router.push(`/technician/job/${orderId}/complete`)
                })
              }}
            className="w-full h-12 text-base font-medium transition-all duration-200 active:scale-[0.98]"
            size="lg"
          >
            Selesai Kerja
          </Button>
        )}

        {canonicalStatus === 'COMPLETED' && job.has_report && (
          <div className="text-center text-sm text-ink-mute py-2">
            Laporan sudah disubmit
          </div>
        )}

        {/* Error display */}
        {transitionMutation.isError && (
          <p className="text-sm text-destructive text-center mt-2">
            {transitionMutation.error instanceof Error
              ? transitionMutation.error.message
              : 'Gagal mengubah status'}
          </p>
        )}
      </div>

      {/* Arrival photo modal — shown before Mulai Kerja */}
      <Dialog open={showArrivalModal} onOpenChange={setShowArrivalModal}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Foto Kedatangan</DialogTitle>
            <DialogDescription>
              Ambil foto sebagai bukti sudah tiba di lokasi pelanggan. Wajib minimal 1 foto, maksimal 3.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <PhotoUpload
              label="Foto Lokasi"
              bucket="service-photos"
              pathPrefix={`orders/${orderId}/arrival`}
              value={arrivalPhotos}
              onChange={setArrivalPhotos}
              min={1}
              max={3}
              disabled={transitionMutation.isPending}
            />
          </div>

          {arrivalPhotos.length === 0 && (
            <p className="text-xs text-destructive">Minimal 1 foto wajib diupload</p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowArrivalModal(false)
                setArrivalPhotos([])
              }}
              disabled={transitionMutation.isPending}
              className="h-11 w-full sm:h-9 sm:w-auto transition-all duration-200 active:scale-[0.98]"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (arrivalPhotos.length === 0) return
                setShowArrivalModal(false)
                transitionMutation.mutate({ toStatus: 'IN_PROGRESS', arrivalPhotos })
              }}
              disabled={arrivalPhotos.length === 0 || transitionMutation.isPending}
              className="h-11 w-full sm:h-9 sm:w-auto transition-all duration-200 active:scale-[0.98]"
            >
              {transitionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Konfirmasi & Mulai Kerja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
