'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  parseCatalogCSV,
  type ImportCatalogResult,
  type ImportRowError,
} from '@/lib/catalog-csv'

export type { ImportCatalogResult, ImportRowError } from '@/lib/catalog-csv'

export async function importCatalogCSV(csvContent: string): Promise<ImportCatalogResult> {
  try {
    const { rows, errors: parseErrors, headerError } = parseCatalogCSV(csvContent)

    if (headerError) {
      return { success: false, importedCount: 0, errors: [], error: headerError }
    }

    const errors: ImportRowError[] = [...parseErrors]
    const supabase = await createClient()

    const [unitTypesRes, capacityRes, serviceTypesRes, existingMsnRes] = await Promise.all([
      supabase.from('unit_types').select('unit_type_id, name'),
      supabase.from('capacity_ranges').select('capacity_id, unit_type_id, capacity_label'),
      supabase.from('service_types').select('service_type_id, code'),
      supabase.from('service_catalog').select('msn_code'),
    ])

    const lookupErr =
      unitTypesRes.error || capacityRes.error || serviceTypesRes.error || existingMsnRes.error
    if (lookupErr) {
      logger.error('importCatalogCSV lookup failed:', lookupErr)
      return { success: false, importedCount: 0, errors: [], error: lookupErr.message }
    }

    const unitTypeByName = new Map<string, string>()
    for (const u of unitTypesRes.data || []) {
      unitTypeByName.set(u.name.trim().toLowerCase(), u.unit_type_id)
    }

    const capacityByKey = new Map<string, string>()
    for (const c of capacityRes.data || []) {
      capacityByKey.set(
        `${c.unit_type_id}::${c.capacity_label.trim().toLowerCase()}`,
        c.capacity_id
      )
    }

    const serviceTypeByCode = new Map<string, string>()
    for (const s of serviceTypesRes.data || []) {
      serviceTypeByCode.set(s.code.trim().toLowerCase(), s.service_type_id)
    }

    const existingMsn = new Set<string>()
    for (const e of existingMsnRes.data || []) {
      existingMsn.add(e.msn_code)
    }

    const seenInBatch = new Set<string>()
    const payloads: Record<string, unknown>[] = []

    for (const row of rows) {
      if (row.base_price < 0) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `base_price tidak boleh negatif (${row.base_price}).`,
        })
        continue
      }

      if (existingMsn.has(row.msn_code)) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `msn_code "${row.msn_code}" sudah ada di database.`,
        })
        continue
      }
      if (seenInBatch.has(row.msn_code)) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `msn_code "${row.msn_code}" duplikat di dalam file CSV.`,
        })
        continue
      }

      const unitTypeId = unitTypeByName.get(row.unit_type_name.trim().toLowerCase())
      if (!unitTypeId) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `unit_type "${row.unit_type_name}" tidak ditemukan.`,
        })
        continue
      }

      const capacityId = capacityByKey.get(
        `${unitTypeId}::${row.capacity_label.trim().toLowerCase()}`
      )
      if (!capacityId) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `capacity "${row.capacity_label}" tidak ditemukan untuk unit_type "${row.unit_type_name}".`,
        })
        continue
      }

      const serviceTypeId = serviceTypeByCode.get(row.service_type_code.trim().toLowerCase())
      if (!serviceTypeId) {
        errors.push({
          rowNumber: row.rowNumber,
          msn_code: row.msn_code,
          message: `service_type code "${row.service_type_code}" tidak ditemukan.`,
        })
        continue
      }

      seenInBatch.add(row.msn_code)
      payloads.push({
        msn_code: row.msn_code,
        unit_type_id: unitTypeId,
        capacity_id: capacityId,
        service_type_id: serviceTypeId,
        service_name: row.service_name,
        base_price: row.base_price,
        includes: row.includes.length > 0 ? row.includes : null,
        is_active: !row.priceBlank,
      })
    }

    if (payloads.length === 0) {
      return { success: errors.length === 0, importedCount: 0, errors }
    }

    const { data, error } = await supabase.from('service_catalog').insert(payloads).select('catalog_id')
    if (error) {
      logger.error('importCatalogCSV insert failed:', error)
      return { success: false, importedCount: 0, errors, error: error.message }
    }

    revalidatePath('/dashboard/settings/service-catalog')
    return { success: true, importedCount: data?.length ?? payloads.length, errors }
  } catch (err) {
    logger.error('importCatalogCSV failed:', err)
    return {
      success: false,
      importedCount: 0,
      errors: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
