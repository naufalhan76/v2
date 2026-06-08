export interface BulkCatalogUpdate {
  matchField: 'catalog_id' | 'msn_code'
  matchValue: string
  payload: Record<string, unknown>
  label: string
}

export interface PreparedBulkCatalogUpdates {
  updates: BulkCatalogUpdate[]
  skippedCount: number
}

export function findBulkUpdateColumn(headers: string[], names: string[]) {
  for (const name of names) {
    const idx = headers.indexOf(name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

export function parseBulkUpdateServiceCatalogCsv(csvText: string): {
  headers: string[]
  records: string[][]
} {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, '')) ?? []
  const records = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')))
  return { headers, records }
}

export function prepareBulkUpdateServiceCatalogRows(
  headers: string[],
  records: string[][]
): PreparedBulkCatalogUpdates {
  const catalogIdIdx = findBulkUpdateColumn(headers, ['catalog_id', 'catalogid', 'id'])
  const msnCodeIdx = findBulkUpdateColumn(headers, ['msn_code', 'msncode', 'msn', 'kode'])
  const serviceNameIdx = findBulkUpdateColumn(headers, ['service_name', 'servicename', 'nama', 'name'])
  const basePriceIdx = findBulkUpdateColumn(headers, ['base_price', 'baseprice', 'price', 'harga'])
  const descriptionIdx = findBulkUpdateColumn(headers, ['description', 'desc', 'deskripsi'])
  const isActiveIdx = findBulkUpdateColumn(headers, ['is_active', 'isactive', 'active', 'status'])

  let skippedCount = 0
  const updates: BulkCatalogUpdate[] = []

  for (const record of records) {
    const catalogId = catalogIdIdx !== -1 ? record[catalogIdIdx] : ''
    const msnCode = msnCodeIdx !== -1 ? record[msnCodeIdx] : ''
    if (!catalogId && !msnCode) { skippedCount++; continue }

    const payload: Record<string, unknown> = {}
    if (serviceNameIdx !== -1 && record[serviceNameIdx]) payload.service_name = record[serviceNameIdx]
    if (basePriceIdx !== -1 && record[basePriceIdx]) {
      const price = parseFloat(record[basePriceIdx].replace(/[^0-9.-]+/g, ''))
      if (!isNaN(price)) payload.base_price = price
    }
    if (descriptionIdx !== -1) payload.description = record[descriptionIdx] || null
    if (isActiveIdx !== -1) {
      const val = record[isActiveIdx].toLowerCase()
      payload.is_active = val === 'true' || val === '1' || val === 'yes' || val === 'aktif'
    }

    if (Object.keys(payload).length === 0) { skippedCount++; continue }

    updates.push({
      matchField: catalogId ? 'catalog_id' : 'msn_code',
      matchValue: catalogId || msnCode,
      payload,
      label: msnCode || catalogId,
    })
  }

  return { updates, skippedCount }
}

export function buildBulkUpdateServiceCatalogMessage(updatedCount: number, skippedCount: number, errorCount: number) {
  const parts: string[] = []
  if (updatedCount > 0) parts.push(`${updatedCount} diupdate`)
  if (skippedCount > 0) parts.push(`${skippedCount} dilewati`)
  if (errorCount > 0) parts.push(`${errorCount} error`)
  return parts.join(', ') || 'Tidak ada perubahan'
}
