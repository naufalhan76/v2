import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCatalogCSV } from '@/lib/catalog-csv'

// ============================================================================
// MOCKS
// ============================================================================
// We mock the Supabase server client so server actions can be exercised
// without a live database. The mock returns a thenable query builder whose
// terminal result is configured per-test via `setQueryResult`.

type QueryResult = { data: unknown; error: { message: string } | null }

let queryResult: QueryResult = { data: [], error: null }

function setQueryResult(result: QueryResult) {
  queryResult = result
}

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {}
  // Chainable, no-op methods that return the same builder.
  for (const method of ['select', 'order', 'eq', 'or', 'update', 'insert', 'single']) {
    builder[method] = vi.fn(() => builder)
  }
  // Make the builder awaitable -> resolves to the configured result.
  ;(builder as { then: unknown }).then = (
    onFulfilled: (value: QueryResult) => unknown
  ) => Promise.resolve(queryResult).then(onFulfilled)
  return builder
}

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => makeQueryBuilder()),
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  getCatalog,
  getCatalogGrouped,
  toggleCatalogActive,
  type ServiceCatalogEntry,
} from '@/lib/actions/service-catalog'

// ============================================================================
// FIXTURES
// ============================================================================

function makeEntry(overrides: Partial<ServiceCatalogEntry> = {}): ServiceCatalogEntry {
  return {
    catalog_id: 'cat-1',
    msn_code: 'RA-CHK-3',
    unit_type_id: 'ut-room-air',
    capacity_id: 'cap-3hp',
    service_type_id: 'st-chk',
    service_name: 'Room Air Checking 3 HP',
    base_price: 115000,
    includes: ['Pemeriksaan tekanan freon'],
    description: null,
    duration_minutes: null,
    is_active: true,
    unit_types: { name: 'Room Air' },
    capacity_ranges: { capacity_label: '3 HP' },
    service_types: { name: 'CHECKING', code: 'CHK' },
    ...overrides,
  }
}

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations')

const SEED_FILES = [
  '03_seed_catalog_room_air.sql',
  '03_seed_catalog_split_duct.sql',
  '03_seed_catalog_skyair_ahu.sql',
  '03_seed_catalog_mnx_vrv.sql',
] as const

// msn_code prefixes introduced by the new seed data, grouped by source file.
const PREFIX_BY_FILE: Record<string, string[]> = {
  '03_seed_catalog_room_air.sql': ['RA-', 'AP-'],
  '03_seed_catalog_split_duct.sql': ['SD-', 'SF-'],
  '03_seed_catalog_skyair_ahu.sql': ['SC-', 'AHU-', 'REF-'],
  '03_seed_catalog_mnx_vrv.sql': ['MXW-', 'MXC-', 'MXO-', 'VW-', 'VCD-', 'VO-'],
}

beforeEach(() => {
  setQueryResult({ data: [], error: null })
})

describe('parseCatalogCSV', () => {
  it('parses a valid comma-delimited catalog CSV', () => {
    const csv = [
      'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes',
      'Room Air,3 HP,CHK,RA-CHK-3,Room Air Checking 3 HP,115000,Cek freon;Cek listrik',
    ].join('\n')

    const { rows, errors, headerError } = parseCatalogCSV(csv)

    expect(headerError).toBeUndefined()
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      unit_type_name: 'Room Air',
      capacity_label: '3 HP',
      service_type_code: 'CHK',
      msn_code: 'RA-CHK-3',
      service_name: 'Room Air Checking 3 HP',
      base_price: 115000,
      priceBlank: false,
    })
    expect(rows[0].includes).toEqual(['Cek freon', 'Cek listrik'])
  })

  it('tolerates TAB-delimited content', () => {
    const csv = [
      'unit_type_name\tcapacity_label\tservice_type_code\tmsn_code\tservice_name\tbase_price\tincludes',
      'Split Duct\t2-3 HP\tCHK\tSD-CHK-2-3\tSplit Duct Checking 2-3 HP\t125000\t',
    ].join('\n')

    const { rows, errors } = parseCatalogCSV(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].msn_code).toBe('SD-CHK-2-3')
    expect(rows[0].base_price).toBe(125000)
  })

  it('flags blank price cells via priceBlank (base_price defaults to 0)', () => {
    const csv = [
      'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes',
      'SkyAir Cassette,0.5-2 HP,PCEK,SC-PCEK-0.5-2,SkyAir Cassette Pengecekan 0.5-2 HP,,',
    ].join('\n')

    const { rows, errors } = parseCatalogCSV(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].priceBlank).toBe(true)
    expect(rows[0].base_price).toBe(0)
  })

  it('rejects empty / header-only content', () => {
    expect(parseCatalogCSV('').headerError).toBeTruthy()
    const headerOnly = 'unit_type_name,capacity_label,service_type_code,msn_code'
    expect(parseCatalogCSV(headerOnly).headerError).toBeTruthy()
  })

  it('rejects a CSV missing required header columns', () => {
    const csv = ['unit_type_name,capacity_label,service_name', 'Room Air,3 HP,Foo'].join('\n')
    const { headerError } = parseCatalogCSV(csv)
    expect(headerError).toBeTruthy()
    expect(headerError).toContain('service_type_code')
    expect(headerError).toContain('msn_code')
  })

  it('reports a row error when msn_code is missing but keeps parsing other rows', () => {
    const csv = [
      'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes',
      'Room Air,3 HP,CHK,,Missing code,100,',
      'Room Air,3 HP,KA,RA-KA-3,Room Air Kategori A 3 HP,225000,',
    ].join('\n')

    const { rows, errors } = parseCatalogCSV(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('msn_code')
    expect(rows).toHaveLength(1)
    expect(rows[0].msn_code).toBe('RA-KA-3')
  })

  it('reports a row error for a non-numeric price', () => {
    const csv = [
      'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes',
      'Room Air,3 HP,CHK,RA-CHK-3,Room Air Checking 3 HP,abc,',
    ].join('\n')

    const { rows, errors } = parseCatalogCSV(csv)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].msn_code).toBe('RA-CHK-3')
  })
})

describe('getCatalog (autofill query)', () => {
  it('returns only active rows when the active result set is mocked', async () => {
    setQueryResult({
      data: [
        makeEntry({ catalog_id: 'a', msn_code: 'RA-CHK-3', is_active: true }),
        makeEntry({ catalog_id: 'b', msn_code: 'RA-KA-3', is_active: true }),
      ],
      error: null,
    })

    const result = await getCatalog({ isActive: true })

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data?.every((e) => e.is_active)).toBe(true)
    expect(result.data?.every((e) => e.base_price > 0)).toBe(true)
  })

  it('surfaces a DB error as a failed result', async () => {
    setQueryResult({ data: null, error: { message: 'boom' } })

    const result = await getCatalog({ isActive: true })
    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('returns an empty array (not an error) when no rows match', async () => {
    setQueryResult({ data: [], error: null })

    const result = await getCatalog({ isActive: true })
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })
})

describe('getCatalogGrouped', () => {
  it('groups active entries by unit_type name', async () => {
    setQueryResult({
      data: [
        makeEntry({ catalog_id: 'a', unit_types: { name: 'Room Air' } }),
        makeEntry({ catalog_id: 'b', unit_types: { name: 'Room Air' } }),
        makeEntry({ catalog_id: 'c', unit_types: { name: 'Split Duct' } }),
      ],
      error: null,
    })

    const result = await getCatalogGrouped({ isActive: true })

    expect(result.success).toBe(true)
    expect(Object.keys(result.data ?? {}).sort()).toEqual(['Room Air', 'Split Duct'])
    expect(result.data?.['Room Air']).toHaveLength(2)
    expect(result.data?.['Split Duct']).toHaveLength(1)
  })

  it('buckets entries with no unit_type join under "Uncategorized"', async () => {
    setQueryResult({
      data: [makeEntry({ catalog_id: 'a', unit_types: null })],
      error: null,
    })

    const result = await getCatalogGrouped()
    expect(result.success).toBe(true)
    expect(result.data?.['Uncategorized']).toHaveLength(1)
  })
})

describe('toggleCatalogActive', () => {
  it('returns the updated entry with the new is_active flag', async () => {
    setQueryResult({
      data: makeEntry({ catalog_id: 'a', is_active: false }),
      error: null,
    })

    const result = await toggleCatalogActive('a', false)
    expect(result.success).toBe(true)
    expect(result.data?.is_active).toBe(false)
  })

  it('returns a failed result when the update errors', async () => {
    setQueryResult({ data: null, error: { message: 'update failed' } })

    const result = await toggleCatalogActive('a', true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('update failed')
  })
})

describe('seed-file msn_code naming patterns', () => {
  it.each(SEED_FILES)('%s exists and is non-empty', (file) => {
    const path = resolve(MIGRATIONS_DIR, file)
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf-8').length).toBeGreaterThan(0)
  })

  it.each(SEED_FILES)('%s uses every expected msn_code prefix', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    for (const prefix of PREFIX_BY_FILE[file]) {
      expect(sql).toContain(`'${prefix}`)
    }
  })

  it('every seeded msn_code uses one of the known prefixes', () => {
    const knownPrefixes = Object.values(PREFIX_BY_FILE).flat()
    const codeLiteral = /\('([A-Z]+-[A-Z0-9.\-]+)'/g

    for (const file of SEED_FILES) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
      let match: RegExpExecArray | null
      let count = 0
      while ((match = codeLiteral.exec(sql)) !== null) {
        const code = match[1]
        const ok = knownPrefixes.some((p) => code.startsWith(p))
        expect(ok, `${file}: unexpected msn_code prefix in "${code}"`).toBe(true)
        count++
      }
      expect(count, `${file}: expected at least one msn_code literal`).toBeGreaterThan(0)
    }
  })
})


