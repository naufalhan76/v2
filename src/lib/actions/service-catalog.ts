'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

// ==========================================
// TYPES
// ==========================================

export interface ServiceCatalogEntry {
  catalog_id: string
  msn_code: string
  unit_type_id: string
  capacity_id: string
  service_type_id: string
  service_name: string
  base_price: number
  includes: string[] | null
  description: string | null
  duration_minutes: number | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  unit_types?: { name: string } | null
  capacity_ranges?: { capacity_label: string } | null
  service_types?: { name: string; code: string } | null
}

export interface CatalogFilters {
  unitTypeId?: string
  serviceTypeId?: string
  search?: string
  isActive?: boolean
}

export interface CreateCatalogInput {
  msn_code: string
  unit_type_id: string
  capacity_id: string
  service_type_id: string
  service_name: string
  base_price: number
  includes?: string[] | null
  description?: string | null
  duration_minutes?: number | null
  is_active?: boolean
}

export type UpdateCatalogInput = Partial<CreateCatalogInput>

export interface CatalogActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ==========================================
// QUERIES
// ==========================================

/**
 * Fetch service catalog entries with optional filters.
 * Joins related lookup tables (unit_types, capacity_ranges, service_types).
 */
export async function getCatalog(
  filters?: CatalogFilters
): Promise<CatalogActionResult<ServiceCatalogEntry[]>> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('service_catalog')
      .select(
        `
        *,
        unit_types(name),
        capacity_ranges(capacity_label),
        service_types(name, code)
      `
      )
      .order('msn_code', { ascending: true })

    if (filters?.unitTypeId) query = query.eq('unit_type_id', filters.unitTypeId)
    if (filters?.serviceTypeId) query = query.eq('service_type_id', filters.serviceTypeId)
    if (typeof filters?.isActive === 'boolean') query = query.eq('is_active', filters.isActive)
    if (filters?.search?.trim()) {
      const term = filters.search.trim()
      query = query.or(`msn_code.ilike.%${term}%,service_name.ilike.%${term}%`)
    }

    const { data, error } = await query
    if (error) {
      logger.error('Error fetching service catalog:', error)
      return { success: false, error: error.message }
    }
    return { success: true, data: (data as ServiceCatalogEntry[]) || [] }
  } catch (err) {
    logger.error('getCatalog failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getCatalogGrouped(
  filters?: CatalogFilters
): Promise<CatalogActionResult<Record<string, ServiceCatalogEntry[]>>> {
  const result = await getCatalog(filters)
  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  const grouped: Record<string, ServiceCatalogEntry[]> = {}
  for (const entry of result.data) {
    const key = entry.unit_types?.name ?? 'Uncategorized'
    ;(grouped[key] ??= []).push(entry)
  }

  return { success: true, data: grouped }
}

// ==========================================
// MUTATIONS
// ==========================================

export async function createCatalogEntry(
  input: CreateCatalogInput
): Promise<CatalogActionResult<ServiceCatalogEntry>> {
  try {
    const supabase = await createClient()
    const payload = {
      msn_code: input.msn_code,
      unit_type_id: input.unit_type_id,
      capacity_id: input.capacity_id,
      service_type_id: input.service_type_id,
      service_name: input.service_name,
      base_price: input.base_price,
      includes: input.includes && input.includes.length > 0 ? input.includes : null,
      description: input.description || null,
      duration_minutes: input.duration_minutes ?? null,
      is_active: input.is_active ?? true,
    }
    const { data, error } = await supabase
      .from('service_catalog')
      .insert(payload)
      .select()
      .single()

    if (error) {
      logger.error('Error creating catalog entry:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings/service-catalog')
    return { success: true, data: data as ServiceCatalogEntry }
  } catch (err) {
    logger.error('createCatalogEntry failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateCatalogEntry(
  catalogId: string,
  input: UpdateCatalogInput
): Promise<CatalogActionResult<ServiceCatalogEntry>> {
  try {
    const supabase = await createClient()
    const payload: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() }
    if (Array.isArray(input.includes)) {
      payload.includes = input.includes.length > 0 ? input.includes : null
    }
    const { data, error } = await supabase
      .from('service_catalog')
      .update(payload)
      .eq('catalog_id', catalogId)
      .select()
      .single()

    if (error) {
      logger.error('Error updating catalog entry:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings/service-catalog')
    return { success: true, data: data as ServiceCatalogEntry }
  } catch (err) {
    logger.error('updateCatalogEntry failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function toggleCatalogActive(
  catalogId: string,
  isActive: boolean
): Promise<CatalogActionResult<ServiceCatalogEntry>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('service_catalog')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('catalog_id', catalogId)
      .select()
      .single()

    if (error) {
      logger.error('Error toggling catalog status:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings/service-catalog')
    return { success: true, data: data as ServiceCatalogEntry }
  } catch (err) {
    logger.error('toggleCatalogActive failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ==========================================
// LOOKUPS (re-exported for convenience)
// ==========================================

export interface UnitTypeOption {
  unit_type_id: string
  name: string
}

export interface CapacityRangeOption {
  capacity_id: string
  unit_type_id: string
  capacity_label: string
}

export interface ServiceTypeOption {
  service_type_id: string
  name: string
  code: string
}

export async function getCatalogLookups(): Promise<
  CatalogActionResult<{
    unitTypes: UnitTypeOption[]
    capacityRanges: CapacityRangeOption[]
    serviceTypes: ServiceTypeOption[]
  }>
> {
  try {
    const supabase = await createClient()
    const [u, c, s] = await Promise.all([
      supabase.from('unit_types').select('unit_type_id, name').order('name', { ascending: true }),
      supabase
        .from('capacity_ranges')
        .select('capacity_id, unit_type_id, capacity_label')
        .order('capacity_label', { ascending: true }),
      supabase
        .from('service_types')
        .select('service_type_id, name, code')
        .order('name', { ascending: true }),
    ])

    if (u.error || c.error || s.error) {
      const error = u.error?.message || c.error?.message || s.error?.message || 'Unknown error'
      logger.error('Error fetching catalog lookups:', { u: u.error, c: c.error, s: s.error })
      return { success: false, error }
    }

    return {
      success: true,
      data: {
        unitTypes: (u.data as UnitTypeOption[]) || [],
        capacityRanges: (c.data as CapacityRangeOption[]) || [],
        serviceTypes: (s.data as ServiceTypeOption[]) || [],
      },
    }
  } catch (err) {
    logger.error('getCatalogLookups failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
