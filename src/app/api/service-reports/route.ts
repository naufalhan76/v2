import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
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

  const { userId } = getAuth(req)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = await createClient()

  // Ownership check: TECHNICIAN can only access their assigned orders
  const { data: userMgmt } = await supabase
    .from('user_management')
    .select('role, auth_user_id')
    .eq('auth_user_id', userId)
    .single()

  if (userMgmt?.role === 'TECHNICIAN') {
    const { data: assignment } = await supabase
      .from('order_technicians')
      .select('technician_id')
      .eq('order_id', orderId)
      .eq('technician_id', userId)
      .is('removed_at', null)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
  }

  const report = await getServiceReport(orderId)
  return NextResponse.json({ success: true, data: report })
}
