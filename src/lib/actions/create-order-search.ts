'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/utils'
import type { CustomerSearchResult } from '@/types/orders'

type AcUnitWithLabels = {
  unit_type_name?: string | null;
  capacity_label?: string | null;
  unit_types?: { name?: string | null } | null;
  capacity_ranges?: { capacity_label?: string | null } | null;
}

function normalizeAcUnitLabels(locations: CustomerSearchResult['locations']) {
  locations?.forEach(loc => {
    loc.ac_units?.forEach(ac => {
      const acWithLabels = ac as AcUnitWithLabels
      ac.unit_type_name = ac.unit_type_name ?? acWithLabels.unit_types?.name ?? null
      ac.capacity_label = ac.capacity_label ?? acWithLabels.capacity_ranges?.capacity_label ?? null
    })
  })
}

/**
 * Search customers by name or phone number (for autocomplete)
 */
export async function searchCustomers(query: string): Promise<{
  success: boolean;
  data?: Array<{ customer_id: string; customer_name: string; phone_number: string; email: string }>;
  error?: string;
}> {
  try {
    const supabase = await createClient()
    const sanitized = sanitizeSearchTerm(query)
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, customer_name, phone_number, email')
      .or(`customer_name.ilike.%${sanitized}%,phone_number.ilike.%${sanitized}%`)
      .limit(7)
    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to search customers' }
  }
}

/**
 * Search customer by phone number
 * Returns customer with locations and AC units if found
 */
export async function searchCustomerByPhone(phone: string): Promise<{
  success: boolean;
  data?: CustomerSearchResult;
  error?: string;
}> {
  try {
    const supabase = await createClient()
    const normalizedPhone = phone.replace(/[^\d+]/g, '')
    
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        customer_id, customer_name, phone_number,
        primary_contact_person, email, billing_address
      `)
      .eq('phone_number', normalizedPhone)
      .single()
    
    if (customerError) {
      if (customerError.code === 'PGRST116') return { success: true, data: undefined }
      throw customerError
    }
    
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select(`
        location_id, full_address, house_number, city, landmarks,
        ac_units (
          ac_unit_id, brand, brand_id, model_number, serial_number,
          unit_type_id, capacity_id, ac_type, capacity_btu,
          room_location, floor_level, position_detail,
          unit_types (name), capacity_ranges (capacity_label), status
        )
      `)
      .eq('customer_id', customer.customer_id)
    
    if (locationsError) throw locationsError
    normalizeAcUnitLabels(locations)

    const acUnitIds = locations?.flatMap(l => l.ac_units?.map(ac => ac.ac_unit_id) || []) || []
    if (acUnitIds.length > 0) {
      const { data: recentItems, error: itemsError } = await supabase
        .from('order_items')
        .select('ac_unit_id, unit_type_id, capacity_id')
        .in('ac_unit_id', acUnitIds)
        .not('unit_type_id', 'is', null)
        .not('capacity_id', 'is', null)
        .order('created_at', { ascending: false })
      
      if (!itemsError && recentItems && recentItems.length > 0) {
        const historyMap = new Map<string, { unit_type_id: string; capacity_id: string }>()
        for (const item of recentItems) {
          if (item.ac_unit_id && !historyMap.has(item.ac_unit_id)) {
            historyMap.set(item.ac_unit_id, { unit_type_id: item.unit_type_id!, capacity_id: item.capacity_id! })
          }
        }
        locations?.forEach(loc => {
          loc.ac_units?.forEach(ac => {
            if ((!ac.unit_type_id || !ac.capacity_id) && historyMap.has(ac.ac_unit_id)) {
              const hist = historyMap.get(ac.ac_unit_id)!
              ac.unit_type_id = ac.unit_type_id || hist.unit_type_id
              ac.capacity_id = ac.capacity_id || hist.capacity_id
            }
          })
        })
      }
    }
    
    return { success: true, data: { ...customer, locations: locations || [] } }
  } catch (error) {
    logger.error('[searchCustomerByPhone] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to search customer' }
  }
}

/**
 * Get customer by ID with locations and AC units
 */
export async function getCustomerWithLocationsById(customerId: string): Promise<{
  success: boolean;
  data?: CustomerSearchResult;
  error?: string;
}> {
  try {
    const supabase = await createClient()

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        customer_id, customer_name, phone_number,
        primary_contact_person, email, billing_address
      `)
      .eq('customer_id', customerId)
      .single()

    if (customerError) {
      if (customerError.code === 'PGRST116') return { success: true, data: undefined }
      throw customerError
    }

    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select(`
        location_id, full_address, house_number, city, landmarks,
        ac_units (
          ac_unit_id, brand, brand_id, model_number, serial_number,
          unit_type_id, capacity_id, ac_type, capacity_btu,
          room_location, floor_level, position_detail,
          unit_types (name), capacity_ranges (capacity_label), status
        )
      `)
      .eq('customer_id', customer.customer_id)

    if (locationsError) throw locationsError
    normalizeAcUnitLabels(locations)

    const acUnitIds = locations?.flatMap(l => l.ac_units?.map(ac => ac.ac_unit_id) || []) || []
    if (acUnitIds.length > 0) {
      const { data: recentItems, error: itemsError } = await supabase
        .from('order_items')
        .select('ac_unit_id, unit_type_id, capacity_id')
        .in('ac_unit_id', acUnitIds)
        .not('unit_type_id', 'is', null)
        .not('capacity_id', 'is', null)
        .order('created_at', { ascending: false })
      
      if (!itemsError && recentItems && recentItems.length > 0) {
        const historyMap = new Map<string, { unit_type_id: string; capacity_id: string }>()
        for (const item of recentItems) {
          if (item.ac_unit_id && !historyMap.has(item.ac_unit_id)) {
            historyMap.set(item.ac_unit_id, { unit_type_id: item.unit_type_id!, capacity_id: item.capacity_id! })
          }
        }
        locations?.forEach(loc => {
          loc.ac_units?.forEach(ac => {
            if ((!ac.unit_type_id || !ac.capacity_id) && historyMap.has(ac.ac_unit_id)) {
              const hist = historyMap.get(ac.ac_unit_id)!
              ac.unit_type_id = ac.unit_type_id || hist.unit_type_id
              ac.capacity_id = ac.capacity_id || hist.capacity_id
            }
          })
        })
      }
    }

    return { success: true, data: { ...customer, locations: locations || [] } }
  } catch (error) {
    logger.error('[getCustomerWithLocationsById] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load customer' }
  }
}
