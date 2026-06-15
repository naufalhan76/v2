'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import {
  buildBulkUpdateServiceCatalogMessage,
  findBulkUpdateColumn,
  parseBulkUpdateServiceCatalogCsv,
  prepareBulkUpdateServiceCatalogRows,
} from '../service-config-bulk-utils'

// ==========================================
// SERVICE TYPES
// ==========================================
export async function createServiceType(input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_types').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function updateServiceType(id: string, input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_types').update(input).eq('service_type_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function deleteServiceType(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('service_types').delete().eq('service_type_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// UNIT TYPES
// ==========================================
export async function createUnitType(input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('unit_types').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function updateUnitType(id: string, input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('unit_types').update(input).eq('unit_type_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function deleteUnitType(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('unit_types').delete().eq('unit_type_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// CAPACITY RANGES
// ==========================================
export async function createCapacityRange(input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('capacity_ranges').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function updateCapacityRange(id: string, input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('capacity_ranges').update(input).eq('capacity_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function deleteCapacityRange(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_ranges').delete().eq('capacity_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// AC BRANDS
// ==========================================
export async function createAcBrand(input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('ac_brands').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function updateAcBrand(id: string, input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('ac_brands').update(input).eq('brand_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function deleteAcBrand(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('ac_brands').delete().eq('brand_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// SERVICE CATALOG CRUD
// ==========================================
export async function createServiceCatalogEntry(input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_catalog').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function updateServiceCatalogEntry(id: string, input: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_catalog').update(input).eq('catalog_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}
export async function deleteServiceCatalogEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('service_catalog').delete().eq('catalog_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// BULK IMPORTS
// ==========================================
export async function bulkImportServiceCatalog(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: "CSV format is invalid or empty" }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))
  try {
    let createdCount = 0
    const unitTypesMap = new Map()
    const capacityMap = new Map()
    for (const record of records) {
      if (record.length < 5) continue
      const [msnCodeRaw, typeActRaw, capacityRaw, svcTypeRaw, priceRaw] = record
      const msn_code = msnCodeRaw.trim()
      const unitTypeName = typeActRaw.trim()
      const capacityLabel = capacityRaw.trim()
      const serviceName = svcTypeRaw.trim()
      let price = parseFloat(priceRaw.replace(/[^0-9.-]+/g,""))
      if (isNaN(price)) price = 0
      let unitTypeId = unitTypesMap.get(unitTypeName)
      if (!unitTypeId) {
        let { data: ut } = await supabase.from('unit_types').select('unit_type_id').ilike('name', unitTypeName).single()
        if (!ut) { const { data: newUt } = await supabase.from('unit_types').insert({ name: unitTypeName }).select().single(); ut = newUt }
        if (ut) { unitTypeId = ut.unit_type_id; unitTypesMap.set(unitTypeName, unitTypeId) }
      }
      let capacityId = capacityMap.get(`${unitTypeId}-${capacityLabel}`)
      if (!capacityId && unitTypeId) {
        let { data: cap } = await supabase.from('capacity_ranges').select('capacity_id').eq('unit_type_id', unitTypeId).ilike('capacity_label', capacityLabel).single()
        if (!cap) { const { data: newCap } = await supabase.from('capacity_ranges').insert({ unit_type_id: unitTypeId, capacity_label: capacityLabel }).select().single(); cap = newCap }
        if (cap) { capacityId = cap.capacity_id; capacityMap.set(`${unitTypeId}-${capacityLabel}`, capacityId) }
      }
      let serviceTypeId
      const serviceCode = serviceName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50)
      let { data: st } = await supabase.from('service_types').select('service_type_id').eq('code', serviceCode).single()
      if (!st) { const { data: newSt } = await supabase.from('service_types').insert({ code: serviceCode, name: serviceName }).select().single(); st = newSt }
      if (st) serviceTypeId = st.service_type_id
      if (unitTypeId && capacityId && serviceTypeId) {
        const { error } = await supabase.from('service_catalog').upsert({ msn_code, unit_type_id: unitTypeId, capacity_id: capacityId, service_type_id: serviceTypeId, service_name: serviceName, base_price: price, is_active: true }, { onConflict: 'msn_code' })
        if (!error) createdCount++
      }
    }
    revalidatePath('/dashboard/konfigurasi/service-config')
    return { success: true, message: `Successfully imported ${createdCount} items.` }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to process import" }
  }
}

export async function bulkImportUnitTypes(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))
  let createdCount = 0
  for (const record of records) {
    if (record.length < 1) continue
    const name = record[0].trim()
    const description = record.length > 1 ? record[1].trim() : null
    if (name) { const { error } = await supabase.from('unit_types').insert({ name, description }); if (!error) createdCount++ }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} unit types.` }
}

export async function bulkImportCapacityRanges(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))
  let createdCount = 0
  for (const record of records) {
    if (record.length < 2) continue
    const unitTypeName = record[0].trim()
    const capacityLabel = record[1].trim()
    if (unitTypeName && capacityLabel) {
      let { data: ut } = await supabase.from('unit_types').select('unit_type_id').ilike('name', unitTypeName).single()
      if (!ut) { const { data: newUt } = await supabase.from('unit_types').insert({ name: unitTypeName }).select().single(); ut = newUt }
      if (ut?.unit_type_id) { const { error } = await supabase.from('capacity_ranges').insert({ unit_type_id: ut.unit_type_id, capacity_label: capacityLabel }); if (!error) createdCount++ }
    }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} capacity ranges.` }
}

export async function bulkImportAcBrands(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))
  let createdCount = 0
  for (const record of records) {
    if (record.length < 1) continue
    const name = record[0].trim()
    if (name) { const { error } = await supabase.from('ac_brands').insert({ name }); if (!error) createdCount++ }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} brands.` }
}

export async function bulkImportServiceTypes(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))
  let createdCount = 0
  for (const record of records) {
    if (record.length < 2) continue
    const codeRaw = record[0].trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
    const name = record[1].trim()
    const description = record.length > 2 ? record[2].trim() : null
    if (codeRaw && name) { const { error } = await supabase.from('service_types').insert({ code: codeRaw, name, description }); if (!error) createdCount++ }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} service types.` }
}

export async function bulkUpdateServiceCatalog(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV kosong atau format tidak valid. Pastikan ada header dan minimal 1 baris data.' }
  const { headers, records } = parseBulkUpdateServiceCatalogCsv(csvText)
  const { updates, skippedCount } = prepareBulkUpdateServiceCatalogRows(headers, records)
  const catalogIdIdx = findBulkUpdateColumn(headers, ['catalog_id', 'catalogid', 'id'])
  const msnCodeIdx = findBulkUpdateColumn(headers, ['msn_code', 'msncode', 'msn', 'kode'])
  if (catalogIdIdx === -1 && msnCodeIdx === -1) return { success: false, error: 'CSV harus memiliki kolom catalog_id atau msn_code untuk matching.' }
  try {
    const updatedAt = new Date().toISOString()
    const results = await Promise.all(updates.map(({ matchField, matchValue, payload }) => supabase.from('service_catalog').update({ ...payload, updated_at: updatedAt }).eq(matchField, matchValue)))
    const errors = results.flatMap((result, index) => result.error ? [`${updates[index].label}: ${result.error.message}`] : [])
    const updatedCount = updates.length - errors.length
    revalidatePath('/dashboard/konfigurasi/service-config')
    return { success: true, message: buildBulkUpdateServiceCatalogMessage(updatedCount, skippedCount, errors.length), updatedCount, skippedCount, errors: errors.length > 0 ? errors : undefined }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal memproses update' }
  }
}
