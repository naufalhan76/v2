import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../helpers'

/**
 * GET /api/technician/dimensions
 * Returns reference dimensions (unit_types, capacity_ranges, ac_brands) for dropdowns.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const supabase = await createClient()

    // Fetch active unit types, capacity ranges, and AC brands
    const [unitTypesRes, capacityRangesRes, acBrandsRes] = await Promise.all([
      supabase
        .from('unit_types')
        .select('unit_type_id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('capacity_ranges')
        .select('capacity_id, unit_type_id, capacity_label')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('ac_brands')
        .select('brand_id, name')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (unitTypesRes.error) throw unitTypesRes.error
    if (capacityRangesRes.error) throw capacityRangesRes.error
    if (acBrandsRes.error) throw acBrandsRes.error

    return jsonSuccess({
      unit_types: unitTypesRes.data || [],
      capacity_ranges: capacityRangesRes.data || [],
      ac_brands: acBrandsRes.data || [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
