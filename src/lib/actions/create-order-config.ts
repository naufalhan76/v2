'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getTechnicians(): Promise<{
  success: boolean;
  data?: Array<{ technician_id: string; full_name: string; employee_id: string }>;
  error?: string;
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('technicians')
      .select('technician_id, technician_name, contact_number')
      .order('technician_name')
    if (error) throw error
    const mapped = data?.map(tech => ({
      technician_id: tech.technician_id,
      full_name: tech.technician_name,
      employee_id: tech.contact_number,
    })) || []
    return { success: true, data: mapped }
  } catch (error) {
    logger.error('[getTechnicians] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch technicians' }
  }
}

/**
 * Get order config master data (unit types, capacity ranges, brands, service types, catalog)
 */
export async function getOrderConfigMasterData() {
  try {
    const supabase = await createClient()
    const [unitTypes, capacityRanges, acBrands, serviceTypes, serviceCatalog] = await Promise.all([
      supabase.from('unit_types').select('*').eq('is_active', true).order('display_order'),
      supabase.from('capacity_ranges').select('*').eq('is_active', true).order('display_order'),
      supabase.from('ac_brands').select('*').eq('is_active', true).order('name'),
      supabase.from('service_types').select('*').eq('is_active', true).order('display_order'),
      supabase.from('service_catalog').select('*, unit_types(name), capacity_ranges(capacity_label), service_types(name, code)').eq('is_active', true)
    ])

    return {
      success: true,
      data: {
        unitTypes: unitTypes.data || [],
        capacityRanges: capacityRanges.data || [],
        acBrands: acBrands.data || [],
        serviceTypes: serviceTypes.data || [],
        serviceCatalog: serviceCatalog.data || []
      }
    }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch master data' }
  }
}

/**
 * Get service types that have at least one active catalog entry
 * matching the given (unitType, capacity) combination.
 */
export async function getServiceTypesForCatalog(
  unitTypeId: string,
  capacityId: string
): Promise<{
  success: boolean;
  data?: Array<{ service_type_id: string; code: string; name: string; display_order: number }>;
  error?: string;
}> {
  try {
    if (!unitTypeId || !capacityId) return { success: true, data: [] }

    const supabase = await createClient()
    const { data: catalogRows, error: catalogError } = await supabase
      .from('service_catalog')
      .select('service_type_id')
      .eq('is_active', true)
      .eq('unit_type_id', unitTypeId)
      .eq('capacity_id', capacityId)
    if (catalogError) throw catalogError

    const serviceTypeIds = Array.from(
      new Set((catalogRows || []).flatMap((r) => (r.service_type_id ? [r.service_type_id] : [])))
    )
    if (serviceTypeIds.length === 0) return { success: true, data: [] }

    const { data: serviceTypes, error: serviceTypesError } = await supabase
      .from('service_types')
      .select('service_type_id, code, name, display_order')
      .eq('is_active', true)
      .in('service_type_id', serviceTypeIds)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
    if (serviceTypesError) throw serviceTypesError

    return { success: true, data: serviceTypes || [] }
  } catch (error: unknown) {
    logger.error('[getServiceTypesForCatalog] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch service types for catalog' }
  }
}
