'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

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
    logger.error('Error creating add-on:', error)
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
    logger.error('Error updating add-on:', error)
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
    logger.error('Error deleting add-on:', error)
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
    logger.error('Error fetching current stock:', fetchError)
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
    logger.error('Error fetching low stock add-ons:', error)
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
    logger.error('Errors in bulk update:', errors)
    throw new Error('Gagal mengupdate beberapa stok')
  }

  revalidatePath('/dashboard/konfigurasi/addons-catalog')
}

export async function bulkUpdateAddons(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV kosong atau format tidak valid. Pastikan ada header dan minimal 1 baris data.' }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
  const records = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')))

  const findIdx = (names: string[]) => {
    for (const name of names) {
      const idx = headers.indexOf(name.toLowerCase())
      if (idx !== -1) return idx
    }
    return -1
  }

  const addonIdIdx = findIdx(['addon_id', 'addonid', 'id'])
  const itemCodeIdx = findIdx(['item_code', 'itemcode', 'code', 'kode'])
  const itemNameIdx = findIdx(['item_name', 'itemname', 'nama', 'name'])
  const categoryIdx = findIdx(['category', 'kategori'])
  const unitPriceIdx = findIdx(['unit_price', 'unitprice', 'price', 'harga'])
  const unitMeasureIdx = findIdx(['unit_of_measure', 'unitofmeasure', 'uom', 'satuan'])
  const stockQtyIdx = findIdx(['stock_quantity', 'stockquantity', 'stock', 'stok'])
  const minStockIdx = findIdx(['minimum_stock', 'minimumstock', 'minstock'])
  const descriptionIdx = findIdx(['description', 'desc', 'deskripsi'])
  const isActiveIdx = findIdx(['is_active', 'isactive', 'active', 'status'])

  if (addonIdIdx === -1 && itemCodeIdx === -1) {
    return { success: false, error: 'CSV harus memiliki kolom addon_id atau item_code untuk matching.' }
  }

  try {
    let updatedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const record of records) {
      const addonId = addonIdIdx !== -1 ? record[addonIdIdx] : ''
      const itemCode = itemCodeIdx !== -1 ? record[itemCodeIdx] : ''
      if (!addonId && !itemCode) { skippedCount++; continue }

      const payload: Record<string, unknown> = {}
      if (itemNameIdx !== -1 && record[itemNameIdx]) payload.item_name = record[itemNameIdx]
      if (categoryIdx !== -1 && record[categoryIdx]) payload.category = record[categoryIdx]
      if (unitPriceIdx !== -1 && record[unitPriceIdx]) {
        const price = parseFloat(record[unitPriceIdx].replace(/[^0-9.-]+/g, ''))
        if (!isNaN(price)) payload.unit_price = price
      }
      if (unitMeasureIdx !== -1 && record[unitMeasureIdx]) payload.unit_of_measure = record[unitMeasureIdx]
      if (stockQtyIdx !== -1 && record[stockQtyIdx]) {
        const qty = parseFloat(record[stockQtyIdx].replace(/[^0-9.-]+/g, ''))
        if (!isNaN(qty)) payload.stock_quantity = qty
      }
      if (minStockIdx !== -1 && record[minStockIdx]) {
        const min = parseFloat(record[minStockIdx].replace(/[^0-9.-]+/g, ''))
        if (!isNaN(min)) payload.minimum_stock = min
      }
      if (descriptionIdx !== -1) payload.description = record[descriptionIdx] || null
      if (isActiveIdx !== -1) {
        const val = record[isActiveIdx].toLowerCase()
        payload.is_active = val === 'true' || val === '1' || val === 'yes' || val === 'aktif'
      }

      if (Object.keys(payload).length === 0) { skippedCount++; continue }

      let query = supabase.from('addon_catalog').update({ ...payload, updated_at: new Date().toISOString() })
      if (addonId) query = query.eq('addon_id', addonId)
      else query = query.eq('item_code', itemCode)
      const { error } = await query
      if (error) errors.push(`${itemCode || addonId}: ${error.message}`)
      else updatedCount++
    }

    revalidatePath('/dashboard/konfigurasi/addons-catalog')
    const parts: string[] = []
    if (updatedCount > 0) parts.push(`${updatedCount} diupdate`)
    if (skippedCount > 0) parts.push(`${skippedCount} dilewati`)
    if (errors.length > 0) parts.push(`${errors.length} error`)
    return { success: true, message: parts.join(', ') || 'Tidak ada perubahan', updatedCount, skippedCount, errors: errors.length > 0 ? errors : undefined }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal memproses update' }
  }
}
