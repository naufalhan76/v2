'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getAcUnits(filters?: {
  search?: string
  locationId?: string
  status?: string
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
      .from('ac_units')
      .select(`
        *,
        locations (
          location_id,
          building_name,
          floor,
          room_number,
          description,
          customers (
            customer_id,
            customer_name,
            primary_contact_person,
            phone_number
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    
    if (filters?.search) {
      query = query.or(`brand.ilike.%${filters.search}%,model_number.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`)
    }
    
    if (filters?.locationId) {
      query = query.eq('location_id', filters.locationId)
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status)
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
    console.error('Error fetching AC units:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch AC units',
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getAcUnitById(acUnitId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ac_units')
      .select(`
        *,
        locations (
          location_id,
          building_name,
          floor,
          room_number,
          description,
          customers (
            customer_id,
            customer_name,
            primary_contact_person,
            phone_number,
            email
          )
        ),
        service_records (
          service_id,
          service_date,
          service_type,
          findings,
          actions_taken,
          parts_used,
          cost,
          status,
          technicians (
            technician_id,
            technician_name,
            contact_number
          )
        )
      `)
      .eq('ac_unit_id', acUnitId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching AC unit:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch AC unit',
    }
  }
}

export async function createAcUnit(acUnitData: {
  location_id: string
  brand: string
  model_number: string
  serial_number: string
  ac_type?: string
  capacity_btu?: number
  installation_date?: string
  status?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ac_units')
      .insert({
        ...acUnitData,
        status: acUnitData.status || 'ACTIVE',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/ac-units')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error creating AC unit:', error)
    return {
      success: false,
      error: error.message || 'Failed to create AC unit',
    }
  }
}

export async function updateAcUnit(acUnitId: string, acUnitData: Partial<{
  brand: string
  model_number: string
  serial_number: string
  ac_type: string
  capacity_btu: number
  installation_date: string
  status: string
}>) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ac_units')
      .update({
        ...acUnitData,
        updated_at: new Date().toISOString(),
      })
      .eq('ac_unit_id', acUnitId)
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/ac-units')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error updating AC unit:', error)
    return {
      success: false,
      error: error.message || 'Failed to update AC unit',
    }
  }
}

export async function deleteAcUnit(acUnitId: string) {
  try {
    const supabase = await createClient()
    
    // Check if AC unit has service records
    const { data: records } = await supabase
      .from('service_records')
      .select('service_id')
      .eq('ac_unit_id', acUnitId)
      .limit(1)
    
    if (records && records.length > 0) {
      return {
        success: false,
        error: 'Cannot delete AC unit with existing service records',
      }
    }
    
    const { error } = await supabase
      .from('ac_units')
      .delete()
      .eq('ac_unit_id', acUnitId)
    
    if (error) throw error
    
    revalidatePath('/ac-units')
    
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error deleting AC unit:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete AC unit',
    }
  }
}
