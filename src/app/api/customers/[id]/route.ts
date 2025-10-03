import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('=== DELETE API ROUTE CALLED ===')
    const { id } = params
    console.log('Deleting customer ID:', id)
    
    const supabase = await createClient()
    console.log('Supabase client created')
    
    const { data, error } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', id)
      .select()
      .single()
    
    console.log('Delete result:', { data, error })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    
    console.log('=== DELETE API ROUTE SUCCESS ===')
    return NextResponse.json({ success: true, data })
    
  } catch (error: any) {
    console.error('=== DELETE API ROUTE ERROR ===')
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('=== UPDATE API ROUTE CALLED ===')
    const { id } = params
    const body = await request.json()
    console.log('Updating customer ID:', id, 'with data:', body)
    
    const supabase = await createClient()
    console.log('Supabase client created')
    
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
    
    console.log('Update result:', { data, error })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    
    console.log('=== UPDATE API ROUTE SUCCESS ===')
    return NextResponse.json({ success: true, data })
    
  } catch (error: any) {
    console.error('=== UPDATE API ROUTE ERROR ===')
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}