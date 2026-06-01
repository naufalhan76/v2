import { describe, it, expect, vi, beforeEach } from 'vitest'

const createClientMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { importCatalogCSV } from '@/lib/actions/bulk-import-catalog'

interface FakeTables {
  unit_types: Array<{ unit_type_id: string; name: string }>
  capacity_ranges: Array<{ capacity_id: string; unit_type_id: string; capacity_label: string }>
  service_types: Array<{ service_type_id: string; code: string }>
  service_catalog: Array<{ msn_code: string }>
}

function buildSupabaseMock(tables: FakeTables, opts?: { insertError?: string }) {
  const inserted: Record<string, unknown>[] = []

  const from = (table: keyof FakeTables) => {
    return {
      select: () => {
        if (table === 'service_catalog') {
          return Promise.resolve({ data: tables.service_catalog, error: null })
        }
        return Promise.resolve({ data: tables[table], error: null })
      },
      insert: (payloads: Record<string, unknown>[]) => ({
        select: () => {
          if (opts?.insertError) {
            return Promise.resolve({ data: null, error: { message: opts.insertError } })
          }
          inserted.push(...payloads)
          return Promise.resolve({
            data: payloads.map(() => ({ catalog_id: crypto.randomUUID() })),
            error: null,
          })
        },
      }),
    }
  }

  return { client: { from }, inserted }
}

const HEADER =
  'unit_type_name,capacity_label,service_type_code,msn_code,service_name,base_price,includes'

const BASE_TABLES: FakeTables = {
  unit_types: [{ unit_type_id: 'ut-room', name: 'Room Air' }],
  capacity_ranges: [
    { capacity_id: 'cap-1', unit_type_id: 'ut-room', capacity_label: '0.5-1.5 HP' },
  ],
  service_types: [{ service_type_id: 'st-chk', code: 'CHK' }],
  service_catalog: [],
}

function clone(t: FakeTables): FakeTables {
  return JSON.parse(JSON.stringify(t))
}

describe('importCatalogCSV', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('imports a valid row and builds the correct payload', async () => {
    const { client, inserted } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN001,Checking,150000,filter;freon'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.success).toBe(true)
    expect(res.importedCount).toBe(1)
    expect(res.errors).toEqual([])
    expect(inserted[0]).toMatchObject({
      msn_code: 'MSN001',
      unit_type_id: 'ut-room',
      capacity_id: 'cap-1',
      service_type_id: 'st-chk',
      base_price: 150000,
      includes: ['filter', 'freon'],
      is_active: true,
    })
  })

  it('inserts a blank-price row as inactive with base_price 0', async () => {
    const { client, inserted } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN002,Checking,,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.success).toBe(true)
    expect(inserted[0]).toMatchObject({ base_price: 0, is_active: false, includes: null })
  })

  it('rejects a row whose msn_code already exists in the DB', async () => {
    const tables = clone(BASE_TABLES)
    tables.service_catalog = [{ msn_code: 'MSN001' }]
    const { client, inserted } = buildSupabaseMock(tables)
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN001,Checking,1000,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(0)
    expect(inserted).toHaveLength(0)
    expect(res.errors[0].message).toContain('sudah ada')
  })

  it('rejects duplicate msn_code within the same file', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [
      HEADER,
      'Room Air,0.5-1.5 HP,CHK,DUP,Checking,1000,',
      'Room Air,0.5-1.5 HP,CHK,DUP,Checking,2000,',
    ].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(1)
    expect(res.errors.some((e) => e.message.includes('duplikat'))).toBe(true)
  })

  it('rejects an unknown unit_type', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Unknown Type,0.5-1.5 HP,CHK,MSN010,Checking,1000,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(0)
    expect(res.errors[0].message).toContain('unit_type')
  })

  it('rejects a capacity that does not belong to the unit_type', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,99 HP,CHK,MSN011,Checking,1000,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(0)
    expect(res.errors[0].message).toContain('capacity')
  })

  it('rejects an unknown service_type code', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,ZZZ,MSN012,Checking,1000,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(0)
    expect(res.errors[0].message).toContain('service_type')
  })

  it('rejects a negative price', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN013,Checking,-500,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.importedCount).toBe(0)
    expect(res.errors[0].message).toContain('negatif')
  })

  it('imports valid rows while reporting errors for invalid ones', async () => {
    const { client, inserted } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const csv = [
      HEADER,
      'Room Air,0.5-1.5 HP,CHK,GOOD1,Checking,1000,',
      'Unknown Type,0.5-1.5 HP,CHK,BAD1,Checking,1000,',
      'Room Air,0.5-1.5 HP,CHK,GOOD2,Checking,2000,',
    ].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.success).toBe(true)
    expect(res.importedCount).toBe(2)
    expect(inserted).toHaveLength(2)
    expect(res.errors).toHaveLength(1)
  })

  it('returns a header error without touching the DB', async () => {
    const { client, inserted } = buildSupabaseMock(clone(BASE_TABLES))
    createClientMock.mockResolvedValue(client)

    const res = await importCatalogCSV('not,a,valid,header')
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(inserted).toHaveLength(0)
  })

  it('surfaces a DB insert error', async () => {
    const { client } = buildSupabaseMock(clone(BASE_TABLES), { insertError: 'db down' })
    createClientMock.mockResolvedValue(client)

    const csv = [HEADER, 'Room Air,0.5-1.5 HP,CHK,MSN020,Checking,1000,'].join('\n')
    const res = await importCatalogCSV(csv)

    expect(res.success).toBe(false)
    expect(res.error).toBe('db down')
  })
})
