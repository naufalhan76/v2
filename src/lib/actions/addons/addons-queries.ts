'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/utils'

export interface Addon {
  addon_id: string
  category: string
  item_name: string
  item_code: string | null
  description: string | null
  unit_of_measure: string
  unit_price: number
  stock_quantity: number
  minimum_stock: number
  applicable_service_types: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GetAddonsFilters {
  category?: string
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
}

export interface CreateAddonInput {
  category: string
  item_name: string
  item_code?: string | null
  description?: string | null
  unit_of_measure: string
  unit_price: number
  stock_quantity?: number
  minimum_stock?: number
  applicable_service_types?: string | null
}

export interface UpdateAddonInput {
  category?: string
  item_name?: string
  item_code?: string | null
  description?: string | null
  unit_of_measure?: string
  unit_price?: number
  stock_quantity?: number
  minimum_stock?: number
  applicable_service_types?: string | null
  is_active?: boolean
}

/**
 * Get all add-ons with optional filtering
 */
export async function getAddons(filters?: GetAddonsFilters): Promise<{
  data: Addon[]
  total: number
  page: number
  limit: number
}> {
  const supabase = await createClient()
  const page = filters?.page || 1
  const limit = filters?.limit || 50
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('addon_catalog')
    .select('*', { count: 'exact' })
    .order('category', { ascending: true })
    .order('item_name', { ascending: true })
    .range(from, to)

  // Filter by category
  if (filters?.category && filters.category !== 'ALL') {
    query = query.eq('category', filters.category)
  }

  // Filter by active status
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  // Search by item name or code
  if (filters?.search) {
    const sanitized = sanitizeSearchTerm(filters.search)
    query = query.or(
      `item_name.ilike.%${sanitized}%,item_code.ilike.%${sanitized}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    logger.error('Error fetching add-ons:', error)
    throw new Error('Gagal memuat data add-ons')
  }

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
  }
}

/**
 * Get add-on by ID
 */
export async function getAddonById(addonId: string): Promise<Addon | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('addon_catalog')
    .select('*')
    .eq('addon_id', addonId)
    .single()

  if (error) {
    logger.error('Error fetching add-on:', error)
    throw new Error('Gagal memuat data add-on')
  }

  return data
}

/**
 * Get add-ons by category
 */
export async function getAddonsByCategory(category: string): Promise<Addon[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('addon_catalog')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('item_name', { ascending: true })

  if (error) {
    logger.error('Error fetching add-ons by category:', error)
    throw new Error('Gagal memuat data add-ons')
  }

  return data || []
}

/**
 * Get active add-ons only
 */
export async function getActiveAddons(): Promise<Addon[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('addon_catalog')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('item_name', { ascending: true })

  if (error) {
    logger.error('Error fetching active add-ons:', error)
    throw new Error('Gagal memuat data add-ons aktif')
  }

  return data || []
}

/**
 * Get low stock add-ons (stock below minimum)
 * @deprecated Stub — stock tracking removed. Returns empty array.
 */
export async function getLowStockAddons(): Promise<Addon[]> {
  // DEPRECATED stub — removed in task 4c
  return []
}
