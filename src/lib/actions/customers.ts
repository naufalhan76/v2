'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getCustomers(filters?: {
  search?: string
  page?: number
  limit?: number
}) {
  try {
    const supabase = await createClient()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('customer_name', { ascending: true })
      .range(from, to)
    
    if (filters?.search) {
      query = query.or(`customer_name.ilike.%${filters.search}%,primary_contact_person.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return {
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error('Error fetching customers:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch customers',
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getCustomerById(customerId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        locations (
          location_id,
          address,
          city,
          province,
          postal_code
        ),
        orders (
          order_id,
          order_type,
          status,
          priority,
          created_at
        )
      `)
      .eq('customer_id', customerId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch customer',
    }
  }
}

export async function createCustomer(customerData: {
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email?: string
  billing_address?: string
  notes?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...customerData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/customer')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error creating customer:', error)
    return {
      success: false,
      error: error.message || 'Failed to create customer',
    }
  }
}

export async function updateCustomer(customerId: string, customerData: Partial<{
  customer_name: string
  primary_contact_person: string
  phone_number: string
  email: string
  billing_address: string
  notes: string
}>) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('customers')
      .update({
        ...customerData,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId)
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/customer')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error updating customer:', error)
    return {
      success: false,
      error: error.message || 'Failed to update customer',
    }
  }
}

export async function deleteCustomer(customerId: string) {
  try {
    const supabase = await createClient()
    
    // Check if customer has orders
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id')
      .eq('customer_id', customerId)
      .limit(1)
    
    if (orders && orders.length > 0) {
      return {
        success: false,
        error: 'Cannot delete customer with existing orders',
      }
    }
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', customerId)
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/customer')
    revalidatePath('/dashboard')
    
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error deleting customer:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete customer',
    }
  }
}
