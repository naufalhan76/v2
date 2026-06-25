'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Timer } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/orders/status-badge'
import { JobDetailSkeleton } from './job-detail-skeleton'
import { useState, useEffect } from 'react'
import type { OrderStatus } from '@/lib/order-status'
import { captureGps } from '@/lib/utils/geolocation'
import type { GpsResult } from '@/lib/utils/geolocation'
import { isTimerActive, getElapsedSeconds } from '@/lib/offline/timer'
import { jobToSnapshot, lockJobSnapshot, saveJobSnapshot } from '@/lib/offline/snapshot'
import { CustomerInfoCard } from './customer-info-card'
import { ServiceInfoCard } from './service-info-card'

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
}

async function buildTransitionPayload(toStatus: string): Promise<TransitionPayload> {
  const gps = await captureGps({ timeoutMs: 5_000 })
  return {
    to_status: toStatus,
    idempotency_key: crypto.randomUUID(),
    gps,
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
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => getElapsedSeconds(orderId))


  const { data: job, isLoading, isError, error } = useQuery({
    queryKey: ['technician', 'job', orderId],
    queryFn: () => fetchJobDetail(orderId),
    staleTime: 30_000,
  })

  const transitionMutation = useMutation({
    mutationFn: async (params: { toStatus: string }) => {
      await lockJobSnapshot(orderId)
      const payload = await buildTransitionPayload(params.toStatus)
      return transitionJob(orderId, payload)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['technician', 'job', orderId] })
      queryClient.invalidateQueries({ queryKey: ['technician', 'jobs', 'today'] })
      if (variables.toStatus === 'IN_PROGRESS') {
        void lockJobSnapshot(orderId).finally(() => {
          router.push(`/technician/job/${orderId}/complete`)
        })
      }
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

  // Persistent timer — reads from localStorage every second
  useEffect(() => {
    if (!isTimerActive(orderId)) return

    const interval = setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(orderId))
    }, 1000)

    return () => clearInterval(interval)
  }, [orderId])

  if (isLoading) return <JobDetailSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive mb-4">
          {error instanceof Error ? error.message : 'Terjadi kesalahan'}
        </p>
        <Button onClick={() => router.back()} className="bg-primary text-white flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-hover transition-colors h-auto">
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

  return (
    <div className="space-y-4">
      {/* Back button + status */}
      <div className="flex items-center justify-between">
        <Button className="bg-primary text-white flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:bg-primary-hover transition-colors h-auto" asChild>
          <Link href="/technician">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1">Kembali</span>
          </Link>
        </Button>
        <StatusBadge status={job.status} />
      </div>

      {/* Customer info card */}
      <CustomerInfoCard
        customer={customer}
        location={location}
        scheduledTime={scheduledTime}
      />

      {/* Service info card */}
      <ServiceInfoCard orderItem={orderItem} />

      {/* Notes */}
      {job.notes && (
        <div className="rounded-lg border border-border dark:border-border bg-background dark:bg-surface-muted p-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2 dark:text-muted-foreground">
            Catatan
          </h3>
          <p className="text-sm text-pretty whitespace-pre-wrap leading-relaxed">{job.notes}</p>
        </div>
      )}

      {/* Work timer (active timer for this order only) */}
      {isTimerActive(orderId) && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 dark:border-primary dark:bg-surface p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Timer className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-primary">
              Waktu Kerja
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground tabular-nums tracking-tight">
            {String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0')}:
            {String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0')}:
            {String(elapsedSeconds % 60).padStart(2, '0')}
          </p>
        </div>
      )}

      {/* Action buttons — state-aware */}
      <div className="pt-2 pb-4">
        {canonicalStatus === 'ASSIGNED' && (
          <Button
            onClick={() => transitionMutation.mutate({ toStatus: 'EN_ROUTE' })}
            disabled={transitionMutation.isPending}
            className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors h-auto text-base active:scale-[0.98] disabled:opacity-60"
            size="lg"
          >
            {transitionMutation.isPending ? 'Memproses...' : 'Berangkat'}
          </Button>
        )}

        {canonicalStatus === 'EN_ROUTE' && (
          <Button
            onClick={() => {
              transitionMutation.mutate({ toStatus: 'IN_PROGRESS' })
            }}
            disabled={transitionMutation.isPending}
            className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors h-auto text-base active:scale-[0.98] disabled:opacity-60"
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
            className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-sm hover:bg-primary-hover transition-colors h-auto text-base active:scale-[0.98]"
            size="lg"
          >
            Selesai Kerja
          </Button>
        )}

        {canonicalStatus === 'COMPLETED' && job.has_report && (
          <div className="text-center text-sm text-muted-foreground py-2">
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
    </div>
  )
}
