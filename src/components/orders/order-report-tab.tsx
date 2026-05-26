'use client'

import { FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase-browser'

interface OrderReportTabProps {
  orderId: string
}

interface ServiceReport {
  report_id: string
  actual_total_price: number
  notes: string | null
  submitted_at: string
}

export function OrderReportTab({ orderId }: OrderReportTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['service-report', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_reports')
        .select('report_id, actual_total_price, notes, submitted_at')
        .eq('order_id', orderId)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as ServiceReport | null
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada laporan"
        description="Teknisi belum submit laporan untuk order ini. Laporan akan muncul setelah teknisi menyelesaikan pekerjaan."
      />
    )
  }

  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="font-semibold">Total aktual:</span> Rp{' '}
        {Number(data.actual_total_price).toLocaleString('id-ID')}
      </p>
      <p className="text-muted-foreground">
        Submitted: {new Date(data.submitted_at).toLocaleString('id-ID')}
      </p>
      {data.notes && <p className="text-muted-foreground whitespace-pre-wrap">{data.notes}</p>}
      <p className="text-xs text-muted-foreground italic">
        Laporan lengkap (foto, material, signature) akan tampil di Phase 3.
      </p>
    </div>
  )
}
