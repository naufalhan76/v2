import { NextRequest, NextResponse } from 'next/server'
import { getServiceReport } from '@/lib/service-report'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: 'orderId query param required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const report = await getServiceReport(orderId)
  return NextResponse.json({ success: true, data: report })
}
