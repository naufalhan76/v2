'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

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

export interface GetAddonsFilters {
  category?: string
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
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
    query = query.or(
      `item_name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching add-ons:', error)
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
    console.error('Error fetching add-on:', error)
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
    console.error('Error fetching add-ons by category:', error)
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
    console.error('Error fetching active add-ons:', error)
    throw new Error('Gagal memuat data add-ons aktif')
  }

  return data || []
}

/**
 * Create new add-on
 */
export async function createAddon(input: CreateAddonInput): Promise<Addon> {
  const supabase = await createClient()

  // Check if item code already exists (if provided)
  if (input.item_code) {
    const { data: existing } = await supabase
      .from('addon_catalog')
      .select('addon_id')
      .eq('item_code', input.item_code)
      .single()

    if (existing) {
      throw new Error('Kode item sudah digunakan')
    }
  }

  const { data, error } = await supabase
    .from('addon_catalog')
    .insert({
      category: input.category,
      item_name: input.item_name,
      item_code: input.item_code || null,
      description: input.description || null,
      unit_of_measure: input.unit_of_measure,
      unit_price: input.unit_price,
      stock_quantity: input.stock_quantity || 0,
      minimum_stock: input.minimum_stock || 0,
      applicable_service_types: input.applicable_service_types || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating add-on:', error)
    throw new Error('Gagal menambahkan add-on')
  }

  revalidatePath('/dashboard/konfigurasi/addons-catalog')
  return data
}

/**
 * Update add-on
 */
export async function updateAddon(
  addonId: string,
  input: UpdateAddonInput
): Promise<Addon> {
  const supabase = await createClient()

  // Check if item code already exists (if provided and changed)
  if (input.item_code) {
    const { data: existing } = await supabase
      .from('addon_catalog')
      .select('addon_id')
      .eq('item_code', input.item_code)
      .neq('addon_id', addonId)
      .single()

    if (existing) {
      throw new Error('Kode item sudah digunakan')
    }
  }

  const { data, error } = await supabase
    .from('addon_catalog')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('addon_id', addonId)
    .select()
    .single()

  if (error) {
    console.error('Error updating add-on:', error)
    throw new Error('Gagal mengupdate add-on')
  }

  revalidatePath('/dashboard/konfigurasi/addons-catalog')
  return data
}

/**
 * Delete add-on
 */
export async function deleteAddon(addonId: string): Promise<void> {
  const supabase = await createClient()

  // Check if add-on is used in any orders
  const { data: usedInOrders } = await supabase
    .from('order_addons')
    .select('order_addon_id')
    .eq('addon_id', addonId)
    .limit(1)

  if (usedInOrders && usedInOrders.length > 0) {
    throw new Error(
      'Add-on tidak dapat dihapus karena sudah digunakan dalam order'
    )
  }

  const { error } = await supabase
    .from('addon_catalog')
    .delete()
    .eq('addon_id', addonId)

  if (error) {
    console.error('Error deleting add-on:', error)
    throw new Error('Gagal menghapus add-on')
  }

  revalidatePath('/dashboard/konfigurasi/addons-catalog')
}

/**
 * Toggle add-on status
 */
export async function toggleAddonStatus(
  addonId: string,
  isActive: boolean
): Promise<Addon> {
  return updateAddon(addonId, { is_active: isActive })
}

/**
 * Update stock quantity
 */
export async function updateStock(
  addonId: string,
  quantity: number,
  operation: 'add' | 'subtract' | 'set'
): Promise<Addon> {
  const supabase = await createClient()

  // Get current stock
  const { data: currentAddon, error: fetchError } = await supabase
    .from('addon_catalog')
    .select('stock_quantity')
    .eq('addon_id', addonId)
    .single()

  if (fetchError) {
    console.error('Error fetching current stock:', fetchError)
    throw new Error('Gagal memuat stok saat ini')
  }

  let newQuantity = 0

  switch (operation) {
    case 'add':
      newQuantity = currentAddon.stock_quantity + quantity
      break
    case 'subtract':
      newQuantity = Math.max(0, currentAddon.stock_quantity - quantity)
      break
    case 'set':
      newQuantity = quantity
      break
  }

  return updateAddon(addonId, { stock_quantity: newQuantity })
}

/**
 * Get low stock add-ons (stock below minimum)
 */
export async function getLowStockAddons(): Promise<Addon[]> {
  const supabase = await createClient()

  // Fetch all active addons and filter in JavaScript
  // because Supabase doesn't support column-to-column comparison
  const { data, error } = await supabase
    .from('addon_catalog')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('item_name', { ascending: true })

  if (error) {
    console.error('Error fetching low stock add-ons:', error)
    throw new Error('Gagal memuat data add-ons dengan stok rendah')
  }

  // Filter where stock_quantity < minimum_stock
  const lowStockItems = (data || []).filter(
    (addon) => addon.stock_quantity < addon.minimum_stock
  )

  return lowStockItems
}

/**
 * Bulk update stock (for inventory adjustments)
 */
export async function bulkUpdateStock(
  updates: Array<{ addon_id: string; quantity: number }>
): Promise<void> {
  const supabase = await createClient()

  // Update each add-on
  const updatePromises = updates.map(({ addon_id, quantity }) =>
    supabase
      .from('addon_catalog')
      .update({
        stock_quantity: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('addon_id', addon_id)
  )

  const results = await Promise.all(updatePromises)

  // Check for errors
  const errors = results.filter((result) => result.error)
  if (errors.length > 0) {
    console.error('Errors in bulk update:', errors)
    throw new Error('Gagal mengupdate beberapa stok')
  }

  revalidatePath('/dashboard/konfigurasi/addons-catalog')
}
