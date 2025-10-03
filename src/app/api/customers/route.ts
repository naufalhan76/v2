import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    console.log('=== API ROUTE CALLED ===')
    const body = await request.json()
    console.log('Request body:', body)
    
    const supabase = await createClient()
    console.log('Supabase client created')
    
    const { data, error } = await supabase
      .from('customers')
      .insert({
        customer_name: body.customer_name,
        primary_contact_person: body.primary_contact_person,
        phone_number: body.phone_number,
        email: body.email,
        billing_address: body.billing_address,
        notes: body.notes || null
      })
      .select()
      .single()
    
    console.log('Insert result:', { data, error })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    
    console.log('=== API ROUTE SUCCESS ===')
    return NextResponse.json({ success: true, data })
    
  } catch (error: any) {
    console.error('=== API ROUTE ERROR ===')
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}