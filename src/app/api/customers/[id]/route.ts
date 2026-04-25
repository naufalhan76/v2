import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    logger.debug('Deleting customer ID:', id)
    
    const supabase = await createClient()
    logger.debug('Supabase client created')
    
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
    
  } catch (error: any) {
    logger.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    logger.debug('Updating customer ID:', id, 'with data:', body)
    
    const supabase = await createClient()
    logger.debug('Supabase client created')
    
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
    
  } catch (error: any) {
    logger.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}