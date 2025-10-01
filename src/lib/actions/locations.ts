'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getLocations(filters?: {
  search?: string
  customerId?: string
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
      .from('locations')
      .select(`
        *,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    
    if (filters?.search) {
      query = query.or(`building_name.ilike.%${filters.search}%,room_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId)
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
    console.error('Error fetching locations:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch locations',
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getLocationById(locationId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number,
          email
        ),
        ac_units (
          ac_unit_id,
          brand,
          model_number,
          serial_number,
          status
        )
      `)
      .eq('location_id', locationId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching location:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch location',
    }
  }
}

export async function updateLocation(locationId: string, locationData: Partial<{
  building_name: string
  floor: number
  room_number: string
  description: string
}>) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('locations')
      .update({
        ...locationData,
        updated_at: new Date().toISOString(),
      })
      .eq('location_id', locationId)
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/lokasi')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error updating location:', error)
    return {
      success: false,
      error: error.message || 'Failed to update location',
    }
  }
}

export async function deleteLocation(locationId: string) {
  try {
    const supabase = await createClient()
    
    // Check if location has AC units
    const { data: acUnits } = await supabase
      .from('ac_units')
      .select('ac_unit_id')
      .eq('location_id', locationId)
      .limit(1)
    
    if (acUnits && acUnits.length > 0) {
      return {
        success: false,
        error: 'Cannot delete location with existing AC units',
      }
    }
    
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('location_id', locationId)
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/lokasi')
    
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error deleting location:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete location',
    }
  }
}
