import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

import { bulkImportServiceCatalog, bulkUpdateServiceCatalog } from '@/lib/actions/service-config'

function makeQuery(result: unknown = { data: null, error: null }) {
  const query = {
    select: vi.fn(() => query),
    ilike: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  }
  return query
}

describe('service-config bulk actions', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it('bulk imports catalog rows while preserving existing create-or-reuse semantics', async () => {
    const operations: Array<{ table: string; action: string; payload?: unknown }> = []
    const byTable = {
      unit_types: [{ data: { unit_type_id: 'ut-room' }, error: null }],
      capacity_ranges: [{ data: null, error: null }],
      service_types: [{ data: null, error: null }],
    }

    const client = {
      from: vi.fn((table: keyof typeof byTable | 'service_catalog') => ({
        select: vi.fn(() => {
          operations.push({ table, action: 'select' })
          return {
            ilike: vi.fn(() => makeQuery(byTable[table as keyof typeof byTable]?.shift())),
            eq: vi.fn(() => makeQuery(byTable[table as keyof typeof byTable]?.shift())),
          }
        }),
        insert: vi.fn((payload: unknown) => {
          operations.push({ table, action: 'insert', payload })
          return {
            select: vi.fn(() => makeQuery({
              data: table === 'capacity_ranges'
                ? { capacity_id: 'cap-room' }
                : { service_type_id: 'svc-check' },
              error: null,
            })),
          }
        }),
        upsert: vi.fn((payload: unknown) => {
          operations.push({ table, action: 'upsert', payload })
          return Promise.resolve({ error: null })
        }),
      })),
    }
    createClientMock.mockResolvedValue(client)

    const csv = [
      'msn,type,capacity,service,price',
      'MSN001,Room Air,0.5 PK,Jasa Checking,150000',
    ].join('\n')

    const result = await bulkImportServiceCatalog(csv)

    expect(result).toEqual({ success: true, message: 'Successfully imported 1 items.' })
    expect(operations).toContainEqual({ table: 'unit_types', action: 'select' })
    expect(operations).toContainEqual({ table: 'capacity_ranges', action: 'insert', payload: { unit_type_id: 'ut-room', capacity_label: '0.5 PK' } })
    expect(operations).toContainEqual({ table: 'service_types', action: 'insert', payload: { code: 'JASA_CHECKING', name: 'Jasa Checking' } })
    expect(operations).toContainEqual({
      table: 'service_catalog',
      action: 'upsert',
      payload: expect.objectContaining({ msn_code: 'MSN001', base_price: 150000, is_active: true }),
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/konfigurasi/service-config')
  })

  it('bulk updates catalog rows by id or msn_code and reports skipped rows', async () => {
    const updates: Array<{ payload: Record<string, unknown>; filters: Array<[string, string]> }> = []
    const client = {
      from: vi.fn(() => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          const filters: Array<[string, string]> = []
          updates.push({ payload, filters })
          return {
            eq: vi.fn((field: string, value: string) => {
              filters.push([field, value])
              return Promise.resolve({ error: null })
            }),
          }
        }),
      })),
    }
    createClientMock.mockResolvedValue(client)

    const csv = [
      'catalog_id,msn_code,service_name,base_price,description,is_active',
      'cat-1,,Updated Name,250000,,FALSE',
      ',MSN002,,300000,Desc,aktif',
      ',,,,,',
    ].join('\n')

    const result = await bulkUpdateServiceCatalog(csv)

    expect(result.success).toBe(true)
    expect(result).toMatchObject({ updatedCount: 2, skippedCount: 1 })
    expect(updates[0].filters).toEqual([['catalog_id', 'cat-1']])
    expect(updates[0].payload).toMatchObject({ service_name: 'Updated Name', base_price: 250000, description: null, is_active: false })
    expect(updates[1].filters).toEqual([['msn_code', 'MSN002']])
    expect(updates[1].payload).toMatchObject({ base_price: 300000, description: 'Desc', is_active: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/konfigurasi/service-config')
  })
})
