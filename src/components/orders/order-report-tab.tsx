'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, Clock, CheckCircle2, Send } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ReportPhotoGallery } from '@/components/orders/report-photo-gallery'
import { ReportMaterialsTable } from '@/components/orders/report-materials-table'
import { ReportSignatureCard } from '@/components/orders/report-signature-card'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { ServiceReport } from '@/lib/service-report'

interface OrderReportTabProps {
  orderId: string
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export function OrderReportTab({ orderId }: OrderReportTabProps) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['service-report', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/service-reports?orderId=${encodeURIComponent(orderId)}`)
      if (!res.ok) throw new Error('Gagal memuat laporan')
      const json = await res.json()
      return (json?.data ?? null) as ServiceReport | null
    },
  })

  if (isLoading) return <ReportSkeleton />

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Gagal memuat laporan"
        description={error instanceof Error ? error.message : 'Terjadi kesalahan'}
      />
    )
  }

  if (!report) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada laporan"
        description="Teknisi belum submit laporan untuk order ini. Laporan akan muncul setelah teknisi menyelesaikan pekerjaan."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Pricing summary — visually prominent */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Aktual
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(report.actual_total_price)}
            </p>
          </div>
          {report.technicians?.technician_name && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Submitted by</p>
              <p className="text-sm font-medium">
                {report.technicians.technician_name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo galleries */}
      <ReportPhotoGallery title="Foto Sebelum" photos={report.photos_before} />
      <ReportPhotoGallery title="Foto Sesudah" photos={report.photos_after} />

      <Separator />

      {/* Materials */}
      <ReportMaterialsTable materials={report.materials} />

      <Separator />

      {/* Signature */}
      <ReportSignatureCard
        reportId={report.report_id}
        customerNameSigned={report.customer_name_signed}
        signedAt={report.signed_at}
        hasSignature={Boolean(report.customer_signature_url)}
      />

      {/* Notes */}
      {report.notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Catatan Teknisi</p>
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {report.notes}
            </p>
          </div>
        </>
      )}

      {/* Timeline */}
      <Separator />
      <div className="space-y-2">
        <p className="text-sm font-semibold">Timeline</p>
        <dl className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <dt className="w-32">Mulai kerja</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.work_started_at)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <dt className="w-32">Selesai kerja</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.work_completed_at)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5" />
            <dt className="w-32">Submitted</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.submitted_at)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
