'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, MapPin, Wrench, Phone, MessageCircle, ChevronDown, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/orders/status-badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { OrderStatus } from '@/lib/order-status'
import { SwipeToAction } from './swipe-to-action'
import { captureGps } from '@/lib/utils/geolocation'
import { createClient } from '@/lib/supabase-browser'

export interface TodayJob {
  order_id: string
  status: string
  canonical_status: OrderStatus
  scheduled_visit_date: string
  customers: {
    customer_name: string
    primary_contact_person: string | null
    phone_number: string | null
  } | null
  order_items: Array<{
    service_type: string
    locations: {
      full_address: string
      city: string | null
    } | null
  }>
}

interface TodayJobCardProps {
  job: TodayJob
}

export function TodayJobCard({ job }: TodayJobCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isActive = job.canonical_status === 'EN_ROUTE' || job.canonical_status === 'IN_PROGRESS'
  const isPending = job.canonical_status === 'ASSIGNED'
  const scheduledTime = new Date(job.scheduled_visit_date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
  
  const serviceType = job.order_items?.[0]?.service_type ?? 'Service AC'
  const address = job.order_items?.[0]?.locations?.full_address ?? '-'
  const customerName = job.customers?.customer_name ?? 'Customer'
  const phoneRaw = job.customers?.phone_number || ''
  
  const totalAmount = job.order_items?.reduce((acc, item) => acc + ((item as any).total_price || 0), 0) ?? 0

  // Fetch technician profile to get name
  const { data: profile } = useQuery({
    queryKey: ['technician', 'profile'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('technicians')
        .select('technician_name')
        .eq('auth_user_id', user.id)
        .single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })

  const technicianName = profile?.technician_name 
    ? `perkenalkan saya ${profile.technician_name}`
    : 'saya teknisi AC'
  
  // Format phone for WA (replace leading 0 or +62)
  const waPhone = phoneRaw.replace(/^0/, '62').replace(/\D/g, '')
  const waMessage = encodeURIComponent(`Halo, ${technicianName}. Saya ingin mengkonfirmasi jadwal service AC untuk hari ini. Apakah benar dengan Bapak/Ibu ${customerName}?`)

  const transitionMutation = useMutation({
    mutationFn: async (toStatus: OrderStatus) => {
      let gps = null
      try {
        gps = await captureGps({ timeoutMs: 3000 })
      } catch (err) {
        console.warn('Gagal menangkap GPS, melanjutkan tanpa koordinat:', err)
      }

      const res = await fetch(`/api/technician/jobs/${encodeURIComponent(job.order_id)}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to_status: toStatus,
          idempotency_key: crypto.randomUUID(),
          gps,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Gagal update status')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician', 'jobs', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['technician', 'job', job.order_id] })
      toast({ title: 'Status diperbarui' })
    },
    onError: (err: any) => {
      toast({ 
        title: 'Gagal update status', 
        description: err.message || 'Terjadi kesalahan saat memperbarui status.',
        variant: 'destructive' 
      })
    }
  })

  const handleSwipe = async () => {
    if (job.canonical_status === 'ASSIGNED') {
      await transitionMutation.mutateAsync('EN_ROUTE')
      setIsExpanded(false)
    }
  }

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: ['technician', 'job', job.order_id],
      queryFn: async () => {
        const res = await fetch(`/api/technician/jobs/${encodeURIComponent(job.order_id)}`)
        if (!res.ok) throw new Error('Gagal prefetch')
        const json = await res.json()
        if (!json.success) throw new Error('Gagal prefetch')
        return json.data
      },
      staleTime: 30_000,
    })
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleMouseEnter}
      className={cn(
        'block rounded-xl border border-hairline shadow-sm transition-colors duration-200 overflow-hidden',
        isActive
          ? 'border-primary bg-background ring-1 ring-primary/20'
          : 'bg-background hover:border-primary/40'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
          className={cn(
            "group flex w-full text-left p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
            isExpanded ? (isActive ? 'bg-indigo-50 dark:bg-[#252243]' : 'bg-canvas-soft') : (isActive ? 'hover:bg-indigo-50 dark:hover:bg-[#252243]' : 'hover:bg-canvas-soft')
          )}
      >
        <div className="flex w-full items-start gap-3">
          {/* Customer avatar */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-canvas-soft text-ink-mute group-hover:bg-primary/10 group-hover:text-primary'
            )}
            aria-hidden="true"
          >
            {customerName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-gray-500 dark:text-[#a5a3b5] bg-gray-100 dark:bg-[#252243] px-1.5 py-0.5 rounded">{job.order_id}</span>
                <div className="flex items-center gap-1.5 text-xs text-ink-mute">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums tracking-tight font-medium">{scheduledTime}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} size="sm" />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-ink-mute transition-transform duration-300",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-xl truncate text-balance">{customerName}</h3>
              {totalAmount > 0 && (
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap mt-1">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-lg text-ink-mute mb-0.5">
              <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{serviceType}</span>
            </div>

            <div className="flex items-start gap-1.5 text-lg text-ink-mute">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="line-clamp-2">{address}</span>
            </div>

            {isActive && !isExpanded && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {job.canonical_status === 'EN_ROUTE' ? 'Dalam Perjalanan' : 'Sedang Dikerjakan'}
              </div>
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="pt-3 border-t border-hairline">
            {/* Contact Shortcuts */}
            {phoneRaw && (
              <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-status-completed/10 text-status-completed border-status-completed/20 hover:bg-status-completed/20 hover:text-status-completed dark:bg-status-completed/10 dark:border-status-completed/30 dark:text-status-completed dark:hover:bg-status-completed/20"
                    asChild
                  >
                    <a href={`https://wa.me/${waPhone}?text=${waMessage}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 bg-status-assigned/10 text-status-assigned border-status-assigned/20 hover:bg-status-assigned/20 hover:text-status-assigned dark:bg-status-assigned/10 dark:border-status-assigned/30 dark:text-status-assigned dark:hover:bg-status-assigned/20"
                    asChild
                  >
                    <a href={`tel:${phoneRaw}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Telepon
                    </a>
                  </Button>
              </div>
            )}

            {/* Swipe Action (if Pending) */}
            {isPending && (
              <div className="mb-4">
                <SwipeToAction
                  onComplete={handleSwipe}
                  label="Geser untuk Berangkat"
                  loading={transitionMutation.isPending}
                />
              </div>
            )}

            {/* Navigate to Details */}
            <Button
              className="w-full transition-all duration-200 active:scale-[0.98]"
              variant={isActive ? "default" : "secondary"}
              asChild
            >
              <Link href={`/technician/job/${job.order_id}`}>
                <FileText className="mr-2 h-4 w-4" />
                {isActive ? 'Buka Detail Pekerjaan' : 'Lihat Detail'}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
