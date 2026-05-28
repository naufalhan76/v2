import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { getUserFromRequest } from '@/app/api/middleware/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!userData?.role || !['SUPERADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    logger.debug('Deleting customer ID:', id)
    
    const { data, error } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', id)
      .select()
      .single()
    
    logger.debug('Delete result:', { data, error })
    
    if (error) {
      logger.error('Database error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error: unknown) {
    logger.error('API Error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!userData?.role || !['SUPERADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    logger.debug('Updating customer ID:', id, 'with data:', body)
    
    const { data, error } = await supabase
      .from('customers')
      .update({
        customer_name: body.customer_name,
        primary_contact_person: body.primary_contact_person,
        phone_number: body.phone_number,
        email: body.email,
        billing_address: body.billing_address,
        notes: body.notes || null
      })
      .eq('customer_id', id)
      .select()
      .single()
    
    logger.debug('Update result:', { data, error })
    
    if (error) {
      logger.error('Database error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data })
    
  } catch (error: unknown) {
    logger.error('API Error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}