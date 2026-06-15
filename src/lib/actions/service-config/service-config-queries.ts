'use server'

import { createClient } from '@/lib/supabase-server'
import { sanitizeSearchTerm } from '@/lib/utils'

// ==========================================
// SERVICE TYPES
// ==========================================
export async function getServiceTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ==========================================
// UNIT TYPES
// ==========================================
export async function getUnitTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('unit_types')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ==========================================
// CAPACITY RANGES
// ==========================================
export async function getCapacityRanges(unitTypeId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('capacity_ranges')
    .select('*, unit_types(*)')
    .order('display_order', { ascending: true })
    .order('capacity_label', { ascending: true })
  
  if (unitTypeId) {
    query = query.eq('unit_type_id', unitTypeId)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ==========================================
// AC BRANDS
// ==========================================
export async function getAcBrands() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ac_brands')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ==========================================
// SERVICE CATALOG
// ==========================================
export async function getServiceCatalog(filters?: {
  unitTypeId?: string,
  capacityId?: string,
  serviceTypeId?: string,
  search?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('service_catalog')
    .select(`
      *,
      unit_types(name),
      capacity_ranges(capacity_label),
      service_types(name, code)
    `)
    .order('created_at', { ascending: false })

  if (filters?.unitTypeId) query = query.eq('unit_type_id', filters.unitTypeId)
  if (filters?.capacityId) query = query.eq('capacity_id', filters.capacityId)
  if (filters?.serviceTypeId) query = query.eq('service_type_id', filters.serviceTypeId)
  if (filters?.search) {
     const sanitized = sanitizeSearchTerm(filters.search)
     query = query.or(`msn_code.ilike.%${sanitized}%,service_name.ilike.%${sanitized}%`)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}
