import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  createInvoiceFromOrder,
  ServiceReportMissingError,
} from '@/lib/actions/invoices'
import { logger } from '@/lib/logger'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default async function CreateInvoiceFromOrderPage({ params }: PageProps) {
  const { orderId } = await params

  let result: Awaited<ReturnType<typeof createInvoiceFromOrder>> | null = null
  let errorMessage: string | null = null
  let isReportMissing = false

  try {
    result = await createInvoiceFromOrder(orderId)
  } catch (err) {
    if (err instanceof ServiceReportMissingError) {
      isReportMissing = true
      errorMessage = err.message
    } else {
      errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan'
      logger.error('createInvoiceFromOrder failed:', err)
    }
  }

  if (result) {
    // Hand off to the detail page where admin reviews + edits before sending.
    redirect(
      `/dashboard/keuangan/invoices/${result.invoice_id}?prefilled=service-report`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/orders?orderId=${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Order
          </Link>
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            Tidak dapat auto-populate invoice
          </CardTitle>
          <CardDescription className="text-amber-800">
            {errorMessage ?? 'Terjadi kesalahan saat membuat invoice dari order ini.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isReportMissing && (
            <p className="text-sm text-amber-900">
              Order ini belum memiliki service report dari teknisi. Anda bisa:
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/dashboard/keuangan/invoices/create?orderId=${orderId}`}>
                <FileText className="mr-2 h-4 w-4" />
                Buat Invoice Manual
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/orders?orderId=${orderId}`}>
                Lihat Order
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
