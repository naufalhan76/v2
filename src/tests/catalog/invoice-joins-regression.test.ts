import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  adaptKpis,
  adaptStatusBreakdown,
  adaptTopTechnicians,
  adaptRecentOrders,
} from '@/lib/dashboard-data'

type QueryResult = { data: unknown; error: { message: string } | null }

const tableResults = new Map<string, QueryResult>()

function setTableResult(table: string, result: QueryResult) {
  tableResults.set(table, result)
}

function makeQueryBuilder(table: string) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'eq', 'or', 'update', 'insert', 'single']) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: unknown }).then = (
    onFulfilled: (value: QueryResult) => unknown
  ) => Promise.resolve(tableResults.get(table) ?? { data: [], error: null }).then(onFulfilled)
  return builder
}

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => makeQueryBuilder(table)),
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getCatalogLookups } from '@/lib/actions/service-catalog'

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations')

const CATALOG_SEED_FILES = [
  '03_seed_catalog_room_air.sql',
  '03_seed_catalog_split_duct.sql',
  '03_seed_catalog_skyair_ahu.sql',
  '03_seed_catalog_mnx_vrv.sql',
] as const

beforeEach(() => {
  tableResults.clear()
})

describe('service_catalog FK integrity (seed files)', () => {
  it.each(CATALOG_SEED_FILES)('%s resolves FKs by name/code, never hardcoded UUIDs', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it.each(CATALOG_SEED_FILES)('%s joins service_types by code', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).toMatch(/JOIN public\.service_types st\s*ON st\.code = v\.service_code/)
  })

  it.each(CATALOG_SEED_FILES)('%s joins capacity_ranges by unit_type_id + capacity_label', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).toMatch(
      /JOIN public\.capacity_ranges cr\s*ON cr\.unit_type_id = ut\.unit_type_id\s*AND cr\.capacity_label = v\.capacity_label/
    )
  })

  it.each(CATALOG_SEED_FILES)('%s resolves unit_type via a name CTE', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).toMatch(/SELECT unit_type_id FROM public\.unit_types WHERE name = '[^']+'/)
  })

  it.each(CATALOG_SEED_FILES)('%s populates unit_type_id, capacity_id, service_type_id', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).toMatch(/msn_code, unit_type_id, capacity_id, service_type_id/)
  })
})

describe('catalog entry shape matches invoice creation expectations', () => {
  it.each(CATALOG_SEED_FILES)('%s seeds service_name, base_price, includes columns', (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    expect(sql).toMatch(/service_name, base_price, includes, is_active/)
  })

  it('getOrderItemsForInvoice select shape covers the catalog fields it reads', () => {
    const invoicesSrc = readFileSync(
      resolve(__dirname, '../../lib/actions/invoices.ts'),
      'utf-8'
    )
    const requiredCatalogFields = ['catalog_id', 'msn_code', 'service_name', 'base_price']
    for (const field of requiredCatalogFields) {
      expect(invoicesSrc).toContain(field)
    }
  })
})

describe('getCatalogLookups', () => {
  it('returns all three dimension tables with correct counts', async () => {
    setTableResult('unit_types', {
      data: [
        { unit_type_id: 'u1', name: 'Room Air' },
        { unit_type_id: 'u2', name: 'Split Duct' },
      ],
      error: null,
    })
    setTableResult('capacity_ranges', {
      data: [
        { capacity_id: 'c1', unit_type_id: 'u1', capacity_label: '3 HP' },
        { capacity_id: 'c2', unit_type_id: 'u2', capacity_label: '2-3 HP' },
        { capacity_id: 'c3', unit_type_id: 'u2', capacity_label: '4-5 HP' },
      ],
      error: null,
    })
    setTableResult('service_types', {
      data: [{ service_type_id: 's1', name: 'CHECKING', code: 'CHK' }],
      error: null,
    })

    const result = await getCatalogLookups()

    expect(result.success).toBe(true)
    expect(result.data?.unitTypes).toHaveLength(2)
    expect(result.data?.capacityRanges).toHaveLength(3)
    expect(result.data?.serviceTypes).toHaveLength(1)
    expect(result.data?.serviceTypes[0]).toMatchObject({ code: 'CHK' })
  })

  it('fails when any dimension query errors', async () => {
    setTableResult('unit_types', { data: null, error: { message: 'unit_types down' } })
    setTableResult('capacity_ranges', { data: [], error: null })
    setTableResult('service_types', { data: [], error: null })

    const result = await getCatalogLookups()
    expect(result.success).toBe(false)
    expect(result.error).toBe('unit_types down')
  })
})

describe('dashboard adapters tolerate new catalog-backed order shapes', () => {
  it('adaptRecentOrders maps customer join + falls back when absent', () => {
    const out = adaptRecentOrders({
      success: true,
      data: [
        {
          order_id: 'o1',
          order_type: 'SERVICE',
          status: 'COMPLETED',
          order_date: '2026-05-01',
          created_at: '2026-05-01T00:00:00Z',
          customers: { customer_name: 'Acme', phone_number: '0812' },
        },
        {
          order_id: 'o2',
          order_type: 'SERVICE',
          status: 'PENDING',
          order_date: '2026-05-02',
          created_at: '2026-05-02T00:00:00Z',
          customers: null,
        },
      ],
    })

    expect(out).toHaveLength(2)
    expect(out[0].customer_name).toBe('Acme')
    expect(out[1].customer_name).toBe('Unknown')
    expect(out[1].phone_number).toBe('—')
  })

  it('adaptKpis computes deltas and statuses', () => {
    const out = adaptKpis({
      success: true,
      data: {
        totalOrders: 120,
        pendingOrders: 8,
        completedOrders: 100,
        cancelledOrders: 2,
        totalCustomers: 50,
        totalTechnicians: 6,
        totalRevenue: 5_000_000,
        estimatedRevenue: 5_500_000,
        unpaidTransactions: 3,
        previous: {
          totalOrders: 100,
          pendingOrders: 10,
          completedOrders: 80,
          cancelledOrders: 1,
          totalCustomers: 45,
          totalTechnicians: 6,
          totalRevenue: 4_000_000,
          estimatedRevenue: 4_200_000,
          unpaidTransactions: 4,
        },
        windowDays: 30,
      },
    })

    const labels = out.map((k) => k.label)
    expect(labels).toEqual(['Total Orders', 'Pending Orders', 'Completed Orders', 'Total Revenue'])
    expect(out[0]).toMatchObject({ value: 120, delta: 20, status: 'positive' })
    expect(out[1]).toMatchObject({ value: 8, status: 'positive' })
  })

  it('adaptStatusBreakdown computes percentages that account for all rows', () => {
    const out = adaptStatusBreakdown({
      success: true,
      data: { PENDING: 1, COMPLETED: 3 },
    })

    const total = out.reduce((s, i) => s + i.count, 0)
    expect(total).toBe(4)
    const completed = out.find((i) => i.status === 'COMPLETED')
    expect(completed?.percentage).toBe(75)
  })

  it('adaptTopTechnicians computes completion rate', () => {
    const out = adaptTopTechnicians({
      success: true,
      data: [{ id: 't1', name: 'Budi', completed: 9, total: 10 }],
    })
    expect(out[0]).toMatchObject({ id: 't1', name: 'Budi', completionRate: 90 })
  })

  it('all adapters return empty arrays on a failed result', () => {
    expect(adaptRecentOrders({ success: false })).toEqual([])
    expect(adaptKpis({ success: false })).toEqual([])
    expect(adaptStatusBreakdown({ success: false })).toEqual([])
    expect(adaptTopTechnicians({ success: false })).toEqual([])
  })
})

describe('catalog seed files exist', () => {
  it.each(CATALOG_SEED_FILES)('%s is present on disk', (file) => {
    expect(existsSync(resolve(MIGRATIONS_DIR, file))).toBe(true)
  })
})

