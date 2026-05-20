import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { getInvoiceSource } from '@/lib/invoice-utils'
import { requireFinanceRoleAPI } from '@/app/api/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const financeGuard = await requireFinanceRoleAPI(request)
    if (financeGuard) return financeGuard

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('orderId')

    // If orderId provided, check if order has invoice
    if (orderId) {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_id, invoice_number, invoice_type, status, order_id')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data: data?.map(invoice => ({ ...invoice, source: getInvoiceSource(invoice) })) || [],
      })
    }

    // Default: return all invoices
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data?.map(invoice => ({ ...invoice, source: getInvoiceSource(invoice) })) || [],
    })
  } catch (error) {
    logger.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
