'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getTechnicians(filters?: {
  search?: string
  specialization?: string
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
      .from('technicians')
      .select('*', { count: 'exact' })
      .order('technician_name', { ascending: true })
      .range(from, to)
    
    if (filters?.search) {
      query = query.or(`technician_name.ilike.%${filters.search}%,contact_number.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
    }
    
    if (filters?.specialization) {
      query = query.eq('specialization', filters.specialization)
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
    console.error('Error fetching technicians:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch technicians',
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }
  }
}

export async function getTechnicianById(technicianId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('technicians')
      .select(`
        *,
        service_records (
          service_id,
          order_id,
          service_date,
          service_type,
          status,
          orders (
            order_id,
            order_type,
            status,
            customers (
              name,
              phone
            )
          )
        )
      `)
      .eq('technician_id', technicianId)
      .single()
    
    if (error) throw error
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error fetching technician:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch technician',
    }
  }
}

export async function createTechnician(technicianData: {
  technician_name: string
  contact_number: string
  email?: string
  company?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('technicians')
      .insert({
        ...technicianData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/technicians')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error creating technician:', error)
    return {
      success: false,
      error: error.message || 'Failed to create technician',
    }
  }
}

export async function updateTechnician(technicianId: string, technicianData: Partial<{
  technician_name: string
  contact_number: string
  email: string
  company: string
}>) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('technicians')
      .update({
        ...technicianData,
        updated_at: new Date().toISOString(),
      })
      .eq('technician_id', technicianId)
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/technicians')
    
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error updating technician:', error)
    return {
      success: false,
      error: error.message || 'Failed to update technician',
    }
  }
}

export async function deleteTechnician(technicianId: string) {
  try {
    const supabase = await createClient()
    
    // Check if technician has service records
    const { data: records } = await supabase
      .from('service_records')
      .select('service_id')
      .eq('technician_id', technicianId)
      .limit(1)
    
    if (records && records.length > 0) {
      return {
        success: false,
        error: 'Cannot delete technician with existing service records',
      }
    }
    
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('technician_id', technicianId)
    
    if (error) throw error
    
    revalidatePath('/technicians')
    revalidatePath('/dashboard')
    
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error deleting technician:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete technician',
    }
  }
}

export async function getTechnicianAvailability(date?: string) {
  try {
    const supabase = await createClient()
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    // Get all technicians with their service records for the day
    const { data, error } = await supabase
      .from('technicians')
      .select(`
        technician_id,
        name,
        phone,
        specialization,
        service_records!inner (
          service_id,
          service_date,
          status
        )
      `)
    
    if (error) throw error
    
    // Count active services per technician
    const availability = data?.map((tech: any) => {
      const activeServices = tech.service_records?.filter((record: any) => {
        const recordDate = new Date(record.service_date).toISOString().split('T')[0]
        return recordDate === targetDate && ['SCHEDULED', 'IN_PROGRESS'].includes(record.status)
      }).length || 0
      
      return {
        technician_id: tech.technician_id,
        name: tech.name,
        phone: tech.phone,
        specialization: tech.specialization,
        activeServices,
        isAvailable: activeServices < 3, // Assume max 3 services per day
      }
    }) || []
    
    return {
      success: true,
      data: availability,
    }
  } catch (error: any) {
    console.error('Error fetching technician availability:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch technician availability',
      data: [],
    }
  }
}
