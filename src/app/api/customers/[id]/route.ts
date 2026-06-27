import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { getUserFromRequest } from '@/app/api/middleware/auth'
import { UpdateCustomerSchema } from '@/app/api/schemas'
import { handleValidationError } from '@/app/api/utils'

function normalizeUpdateCustomerInput(body: Record<string, unknown>, customerId: string) {
  return {
    ...body,
    customerId,
    customerName: body.customerName ?? body.customer_name,
    primaryContactPerson: body.primaryContactPerson ?? body.primary_contact_person,
    phoneNumber: body.phoneNumber ?? body.phone_number,
    billingAddress: body.billingAddress ?? body.billing_address,
  }
}

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

    const { data: orders } = await supabase
      .from('orders')
      .select('order_id')
      .eq('customer_id', id)
      .is('deleted_at', null)
      .limit(1)

    if (orders && orders.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Customer masih punya order aktif. Tidak bisa dihapus.' },
        { status: 400 }
      )
    }

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

    const validation = UpdateCustomerSchema.safeParse(normalizeUpdateCustomerInput(body, id))
    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const validated = validation.data
    
    const { data, error } = await supabase
      .from('customers')
      .update({
        customer_name: validated.customerName,
        primary_contact_person: validated.primaryContactPerson,
        phone_number: validated.phoneNumber,
        email: validated.email,
        billing_address: validated.billingAddress,
        notes: validated.notes || null,
        lat: validated.lat ?? null,
        lng: validated.lng ?? null,
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
