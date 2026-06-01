export interface ParsedCatalogRow {
  rowNumber: number
  unit_type_name: string
  capacity_label: string
  service_type_code: string
  msn_code: string
  service_name: string
  base_price: number
  /** true when the price cell was blank -> entry inserted inactive */
  priceBlank: boolean
  includes: string[]
}

export interface ImportRowError {
  rowNumber: number
  msn_code: string
  message: string
}

export interface ImportCatalogResult {
  success: boolean
  importedCount: number
  errors: ImportRowError[]
  error?: string
}

const EXPECTED_HEADERS = [
  'unit_type_name',
  'capacity_label',
  'service_type_code',
  'msn_code',
  'service_name',
  'base_price',
  'includes',
] as const

// ==========================================
// CSV PARSING
// ==========================================

/**
 * Detects the delimiter used by the header line. Supports comma and TAB.
 */
function detectDelimiter(headerLine: string): string {
  const tabCount = (headerLine.match(/\t/g) || []).length
  const commaCount = (headerLine.match(/,/g) || []).length
  return tabCount > commaCount ? '\t' : ','
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * Parse raw CSV text into structured rows. Pure function (no DB access) so it
 * can be unit-tested without a Supabase connection.
 *
 * Returns parsed rows plus structural errors (malformed lines). Blank price
 * cells are tolerated and flagged via `priceBlank` (base_price defaults to 0).
 * Negative prices are surfaced as row errors by the caller.
 */
export function parseCatalogCSV(csvContent: string): {
  rows: ParsedCatalogRow[]
  errors: ImportRowError[]
  headerError?: string
} {
  const errors: ImportRowError[] = []
  const lines = (csvContent || '').split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (lines.length < 2) {
    return { rows: [], errors, headerError: 'CSV kosong atau tidak memiliki baris data.' }
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = lines[0].split(delimiter).map((h) => stripQuotes(h).toLowerCase())

  // Build index map so column order changes are tolerated as long as names match.
  const idx: Record<string, number> = {}
  for (const expected of EXPECTED_HEADERS) {
    idx[expected] = headers.indexOf(expected)
  }

  const required = ['unit_type_name', 'capacity_label', 'service_type_code', 'msn_code']
  const missing = required.filter((c) => idx[c] === -1)
  if (missing.length > 0) {
    return {
      rows: [],
      errors,
      headerError: `Header CSV tidak lengkap. Kolom wajib hilang: ${missing.join(', ')}.`,
    }
  }

  const rows: ParsedCatalogRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1 // 1-based, header is row 1
    const cells = lines[i].split(delimiter).map((c) => stripQuotes(c))

    const get = (key: string): string => {
      const at = idx[key]
      return at !== -1 && at < cells.length ? cells[at] : ''
    }

    const msn_code = get('msn_code')
    const unit_type_name = get('unit_type_name')
    const capacity_label = get('capacity_label')
    const service_type_code = get('service_type_code')
    const service_name = get('service_name')

    if (!msn_code) {
      errors.push({ rowNumber, msn_code: '', message: 'msn_code wajib diisi.' })
      continue
    }
    if (!unit_type_name || !capacity_label || !service_type_code) {
      errors.push({
        rowNumber,
        msn_code,
        message: 'unit_type_name, capacity_label, dan service_type_code wajib diisi.',
      })
      continue
    }

    const priceRaw = get('base_price')
    const priceBlank = priceRaw.trim().length === 0
    let base_price = 0
    if (!priceBlank) {
      base_price = parseFloat(priceRaw.replace(/[^0-9.-]+/g, ''))
      if (Number.isNaN(base_price)) {
        errors.push({ rowNumber, msn_code, message: `Harga tidak valid: "${priceRaw}".` })
        continue
      }
    }

    const includesRaw = get('includes')
    const includes = includesRaw
      ? includesRaw
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []

    rows.push({
      rowNumber,
      unit_type_name,
      capacity_label,
      service_type_code,
      msn_code,
      service_name: service_name || service_type_code,
      base_price,
      priceBlank,
      includes,
    })
  }

  return { rows, errors }
}
