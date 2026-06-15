'use server'

import { createClient } from '@/lib/supabase-server'
import { getUser, getUserRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

const WRITE_ROLES = ['SUPERADMIN', 'ADMIN'] as const

async function checkWriteAccess() {
  const [user, role] = await Promise.all([getUser(), getUserRole()])
  return {
    user,
    role: role && WRITE_ROLES.includes(role as typeof WRITE_ROLES[number]) ? role : null,
  }
}

export async function updateAcUnitNextServiceDate(
  acUnitId: string,
  newDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, role } = await checkWriteAccess()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (!role) return { success: false, error: 'Forbidden: insufficient role' }

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
    const { user, role } = await checkWriteAccess()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (!role) return { success: false, error: 'Forbidden: insufficient role' }

    const supabase = await createClient()

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

    return { success: true, data }
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
  unit_type_id: string
  capacity_id: string
  brand_id: string
}>) {
  try {
    const { user, role } = await checkWriteAccess()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (!role) return { success: false, error: 'Forbidden: insufficient role' }

    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ac_units')
      .update({ ...acUnitData, updated_at: new Date().toISOString() })
      .eq('ac_unit_id', acUnitId)
      .select()
      .single()
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/ac-units')
    
    return { success: true, data }
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
    const { user, role } = await checkWriteAccess()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (!role) return { success: false, error: 'Forbidden: insufficient role' }

    const supabase = await createClient()
    
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
    
    const { error } = await supabase.from('ac_units').delete().eq('ac_unit_id', acUnitId)
    
    if (error) throw error
    
    revalidatePath('/ac-units')
    
    return { success: true }
  } catch (error: unknown) {
    logger.error('Error deleting AC unit:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete AC unit',
    }
  }
}
