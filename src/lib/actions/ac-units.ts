'use server'

import { createClient } from '@/lib/supabase-server'
import { getUser, getUserRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/utils'

const WRITE_ROLES = ['SUPERADMIN', 'ADMIN'] as const

export async function updateAcUnitNextServiceDate(
  acUnitId: string,
  newDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const role = await getUserRole()
    if (!role || !WRITE_ROLES.includes(role as typeof WRITE_ROLES[number])) {
      return { success: false, error: 'Forbidden: insufficient role' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('ac_units')
      .update({
        next_service_due_date: newDate ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('ac_unit_id', acUnitId)

    if (error) throw error

    revalidatePath('/dashboard/reminders')
    return { success: true }
  } catch (err) {
    logger.error('updateAcUnitNextServiceDate failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update date',
    }
  }
}

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
        unit_types (
          unit_type_id,
          name
        ),
        capacity_ranges (
          capacity_id,
          capacity_label
        ),
        ac_brands (
          brand_id,
          name
        ),
        locations (
          location_id,
          full_address,
          house_number,
          city,
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
      const sanitized = sanitizeSearchTerm(filters.search)
      query = query.or(`brand.ilike.%${sanitized}%,model_number.ilike.%${sanitized}%,serial_number.ilike.%${sanitized}%`)
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
  } catch (error: unknown) {
    logger.error('Error fetching AC units:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AC units',
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
        ac_brands (
          brand_id,
          name
        ),
        locations (
          location_id,
          full_address,
          house_number,
          city,
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
  } catch (error: unknown) {
    logger.error('Error fetching AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch AC unit',
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
  unit_type_id?: string
  capacity_id?: string
  brand_id?: string
}) {
  try {
    const supabase = await createClient()

    // Strip empty-string ids so they don't violate FK constraints
    const cleanData = {
      ...acUnitData,
      unit_type_id: acUnitData.unit_type_id || undefined,
      capacity_id: acUnitData.capacity_id || undefined,
      brand_id: acUnitData.brand_id || undefined,
      installation_date: acUnitData.installation_date || undefined,
      status: acUnitData.status || 'ACTIVE',
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('ac_units')
      .insert(cleanData)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/dashboard/manajemen/ac-units')
    revalidatePath('/dashboard/manajemen/customer')

    return {
      success: true,
      data,
    }
  } catch (error: unknown) {
    logger.error('Error creating AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create AC unit',
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
  // New hierarchical fields (Phase 3)
  unit_type_id: string
  capacity_id: string
  brand_id: string
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
    
    revalidatePath('/dashboard/manajemen/ac-units')
    
    return {
      success: true,
      data,
    }
  } catch (error: unknown) {
    logger.error('Error updating AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update AC unit',
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
  } catch (error: unknown) {
    logger.error('Error deleting AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete AC unit',
    }
  }
}
