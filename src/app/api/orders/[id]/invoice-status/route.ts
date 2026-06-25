import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/app/api/middleware/auth'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { logRequest, logResponse, measureDuration } from '@/app/api/middleware/logging'
import { logger } from '@/lib/logger'

const log = logger.child('orders-invoice-status')

export interface OrderInvoiceStatusResponse {
  hasExistingInvoice: boolean
  invoiceType: 'PROFORMA' | 'FINAL' | null
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceTotal: number | null
  hasServiceReport: boolean
  materials: Array<{
    name: string
    qty: number
    unit_price: number
    total: number
    is_manual: boolean
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const getDuration = measureDuration()
  const method = 'GET'
  const { id: orderId } = await params
  const path = `/api/orders/${orderId}/invoice-status`

  try {
    const user = await requireAuth(request)
    if (!user) {
      return jsonError('Unauthorized: Missing or invalid authentication', 401)
    }

    logRequest(method, path, user.id, { action: 'invoice-status' })

    const supabase = await createClient()

    const { data: userMgmt } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const role = userMgmt?.role ?? null
    if (!role || role === 'TECHNICIAN') {
      return jsonError('Forbidden: Insufficient permissions', 403)
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('invoice_id, invoice_number, invoice_type, total_amount')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invoiceError) {
      log.error('Error fetching invoice status:', invoiceError)
      return jsonError('Gagal memuat status invoice', 500)
    }

    const { data: report, error: reportError } = await supabase
      .from('service_reports')
      .select('materials')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reportError) {
      log.error('Error fetching service report:', reportError)
      return jsonError('Gagal memuat laporan teknisi', 500)
    }

    const rawMaterials = (report?.materials ?? []) as Array<{
      name?: string
      qty?: number
      unit_price?: number
      total?: number
      is_manual?: boolean
    }>

    const materials = rawMaterials.map((m) => ({
      name: m.name ?? '',
      qty: Number(m.qty ?? 0),
      unit_price: Number(m.unit_price ?? 0),
      total: Number(m.total ?? 0),
      is_manual: Boolean(m.is_manual ?? false),
    }))

    const response: OrderInvoiceStatusResponse = {
      hasExistingInvoice: Boolean(invoice),
      invoiceType: invoice?.invoice_type === 'PROFORMA' || invoice?.invoice_type === 'FINAL'
        ? invoice.invoice_type
        : null,
      invoiceId: invoice?.invoice_id ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
      invoiceTotal: invoice?.total_amount ?? null,
      hasServiceReport: Boolean(report),
      materials,
    }

    logResponse(logRequest(method, path, user.id), 200, getDuration())
    return jsonSuccess(response)
  } catch (error) {
    const duration = getDuration()
    logResponse(logRequest(method, path), 500, duration, String(error))
    return handleApiError(error)
  }
}
