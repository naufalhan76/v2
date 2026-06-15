'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { PenLine, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'

interface ReportSignatureCardProps {
  reportId: string
  customerNameSigned: string | null
  signedAt: string | null
  hasSignature: boolean
}

/**
 * Renders the customer's signature image. The signature lives in a private
 * Supabase Storage bucket — we fetch a signed URL from the API on mount
 * (1-hour expiry, refreshed via TanStack Query staleTime).
 */
export function ReportSignatureCard({
  reportId,
  customerNameSigned,
  signedAt,
  hasSignature,
}: ReportSignatureCardProps) {
  const { data: signatureUrl, isLoading } = useQuery({
    queryKey: ['service-report-signature', reportId],
    queryFn: async () => {
      const res = await fetch(`/api/service-reports/${reportId}/signature`)
      if (!res.ok) throw new Error('Gagal memuat signature')
      const json = await res.json()
      return (json?.data?.signedUrl as string | null) ?? null
    },
    enabled: hasSignature,
    staleTime: 50 * 60 * 1000, // 50 min — slightly less than 1h signed URL TTL
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-lg font-[540] text-foreground">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        Tanda Tangan Customer
      </div>

      {!hasSignature ? (
        <p className="rounded-md border border-dashed border-border p-3 text-base text-muted-foreground">
          Belum ada tanda tangan customer.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !signatureUrl ? (
        <p className="rounded-md border border-dashed border-border p-3 text-base text-destructive">
          Gagal memuat signature. Coba refresh halaman.
        </p>
      ) : (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="relative h-32 w-full overflow-hidden rounded bg-surface-muted">
            <Image
              src={signatureUrl}
              alt={`Tanda tangan ${customerNameSigned ?? 'customer'}`}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex items-start gap-2 text-base text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-status-paid" />
            <div className="space-y-0.5">
              <p>
                Ditandatangani oleh{' '}
                <span className="font-semibold text-foreground">
                  {customerNameSigned || '—'}
                </span>
              </p>
              <p>{formatDateTime(signedAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
