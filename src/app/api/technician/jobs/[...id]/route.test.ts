import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('../../helpers', () => ({
  authenticateTechnician: vi.fn(async () => ({ userId: 'user-tech-1', technicianId: 'tech-1' })),
  isTechnicianContext: vi.fn((result) => 'technicianId' in result),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    child: vi.fn(() => ({ error: vi.fn() })),
  },
}))

const { createClient } = await import('../../../../../lib/supabase-server')

type QueryResult = { data: unknown; error: unknown }

class QueryBuilder {
  private filters: Array<[string, unknown]> = []

  constructor(
    private table: string,
    private results: Record<string, QueryResult>,
    private selects: Array<{ table: string; columns: string }>
  ) {}

  select(columns: string) {
    this.selects.push({ table: this.table, columns })
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  is() {
    return this
  }

  maybeSingle() {
    return Promise.resolve(this.results[this.table])
  }

  single() {
    return Promise.resolve(this.results[this.table])
  }
}

function createSupabaseMock(results: Record<string, QueryResult>) {
  const selects: Array<{ table: string; columns: string }> = []
  const client = {
    from: vi.fn((table: string) => new QueryBuilder(table, results, selects)),
    __selects: selects,
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

function request() {
  return new NextRequest('http://localhost/api/technician/jobs/order-1')
}

function params(orderId = 'order-1') {
  return { params: Promise.resolve({ id: [orderId] }) }
}

const baseOrder = {
  order_id: 'order-1',
  customer_id: 'customer-1',
  status: 'IN_PROGRESS',
  scheduled_visit_date: '2026-06-10',
  description: 'Service order',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  customers: { customer_id: 'customer-1', customer_name: 'PT Customer' },
  order_technicians: [],
}

const completeExistingItem = {
  order_item_id: 'item-existing-complete',
  ac_unit_id: 'ac-1',
  location_id: 'loc-1',
  unit_type_id: 'ut-order',
  capacity_id: 'cap-order',
  brand_id: 'brand-order',
  service_type_id: 'svc-clean',
  catalog_id: 'cat-clean',
  msn_code: 'MSN-CLEAN',
  service_type: 'CLEANING',
  quantity: 1,
  description: 'Cuci AC',
  estimated_price: 150000,
  locations: { location_id: 'loc-1', customer_id: 'customer-1', full_address: 'Jl. Mawar', city: 'Jakarta' },
  unit_types: { name: 'Split Wall' },
  capacity_ranges: { capacity_label: '1 PK' },
  ac_brands: { name: 'Daikin' },
  service_catalog: {
    catalog_id: 'cat-clean',
    msn_code: 'MSN-CLEAN',
    service_name: 'Cuci AC Split 1 PK',
    base_price: 150000,
    unit_type_id: 'ut-wall',
    capacity_id: 'cap-1pk',
    service_type_id: 'svc-clean',
    unit_types: { name: 'Split Wall' },
    capacity_ranges: { capacity_label: '1 PK' },
  },
  ac_units: {
    ac_unit_id: 'ac-1',
    customer_id: 'customer-1',
    location_id: 'loc-1',
    brand: null,
    brand_id: 'brand-daikin',
    model_number: 'FTKQ25',
    serial_number: 'SN-1',
    installation_date: '2024-01-01',
    ac_type: null,
    unit_type_id: 'ut-wall',
    capacity_id: 'cap-1pk',
    room_location: 'Ruang Tamu',
    floor_level: '1',
    position_detail: 'Atas TV',
    ac_brands: { name: 'Daikin' },
    unit_types: { name: 'Split Wall' },
    capacity_ranges: { capacity_label: '1 PK' },
    locations: { location_id: 'loc-1', customer_id: 'customer-1', full_address: 'Jl. Mawar', city: 'Jakarta' },
  },
}

const incompleteExistingItem = {
  ...completeExistingItem,
  order_item_id: 'item-existing-incomplete',
  ac_unit_id: 'ac-incomplete',
  ac_units: {
    ...completeExistingItem.ac_units,
    ac_unit_id: 'ac-incomplete',
    brand: null,
    brand_id: null,
    ac_brands: null,
    model_number: null,
    unit_type_id: null,
    unit_types: null,
    capacity_id: null,
    capacity_ranges: null,
    room_location: 'Kamar Utama',
  },
}

const newSlotItem = {
  order_item_id: 'item-new-slot',
  ac_unit_id: null,
  location_id: 'loc-1',
  unit_type_id: 'ut-cassette',
  capacity_id: 'cap-2pk',
  brand_id: 'brand-panasonic',
  service_type_id: 'svc-install',
  catalog_id: 'cat-install',
  msn_code: 'MSN-INSTALL',
  service_type: 'INSTALLATION',
  quantity: 2,
  description: 'Pasang AC',
  estimated_price: 500000,
  locations: { location_id: 'loc-1', customer_id: 'customer-1', full_address: 'Jl. Mawar', city: 'Jakarta' },
  unit_types: { name: 'Cassette' },
  capacity_ranges: { capacity_label: '2 PK' },
  ac_brands: { name: 'Panasonic' },
  service_catalog: {
    catalog_id: 'cat-install',
    msn_code: 'MSN-INSTALL',
    service_name: 'Pasang AC Cassette 2 PK',
    base_price: 500000,
    unit_type_id: 'ut-cassette',
    capacity_id: 'cap-2pk',
    service_type_id: 'svc-install',
    unit_types: { name: 'Cassette' },
    capacity_ranges: { capacity_label: '2 PK' },
  },
  ac_units: null,
}

function mockGet(orderItems: unknown[]) {
  return createSupabaseMock({
    order_technicians: { data: { role: 'lead' }, error: null },
    orders: { data: { ...baseOrder, order_items: orderItems }, error: null },
    service_reports: { data: null, error: null },
  })
}

async function getData(orderItems: unknown[]) {
  mockGet(orderItems)
  const response = await GET(request(), params())
  return { response, body: await response.json() }
}

describe('GET /api/technician/jobs/[orderId] AC hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('selects AC/catalog/location joins needed by the completion wizard', async () => {
    const supabase = mockGet([completeExistingItem])

    await GET(request(), params())

    const orderSelect = supabase.__selects.find((entry) => entry.table === 'orders')?.columns ?? ''
    expect(orderSelect).toContain('ac_unit_id')
    expect(orderSelect).toContain('ac_brands (name)')
    expect(orderSelect).toContain('unit_types (name)')
    expect(orderSelect).toContain('capacity_ranges (capacity_label)')
    expect(orderSelect).toContain('service_catalog')
    expect(orderSelect).toContain('locations (')
  })

  it('hydrates complete existing AC identity and joined labels', async () => {
    const { response, body } = await getData([completeExistingItem])

    expect(response.status).toBe(200)
    expect(body.data.order_items[0]).toMatchObject({ ac_unit_id: 'ac-1', catalog_id: 'cat-clean' })
    expect(body.data.order_items[0].ac_units).toMatchObject({
      ac_unit_id: 'ac-1',
      brand_id: 'brand-daikin',
      brand: 'Daikin',
      unit_type_id: 'ut-wall',
      unit_type_name: 'Split Wall',
      ac_type: 'Split Wall',
      capacity_id: 'cap-1pk',
      capacity_label: '1 PK',
      room_location: 'Ruang Tamu',
      floor_level: '1',
      position_detail: 'Atas TV',
      model_number: 'FTKQ25',
      serial_number: 'SN-1',
      location_id: 'loc-1',
      location: { location_id: 'loc-1', full_address: 'Jl. Mawar' },
    })
    expect(body.data.order_items[0].ac_units.capacity_ranges).toEqual({ capacity_label: '1 PK' })
  })

  it('returns incomplete existing AC as existing slot without fabricating identity', async () => {
    const { body } = await getData([incompleteExistingItem])

    expect(body.data.order_items[0].ac_unit_id).toBe('ac-incomplete')
    expect(body.data.order_items[0].ac_units).toMatchObject({
      ac_unit_id: 'ac-incomplete',
      brand_id: null,
      brand: null,
      unit_type_id: null,
      capacity_id: null,
      room_location: 'Kamar Utama',
    })
  })

  it('returns new AC slot with null ac_unit_id and catalog fields', async () => {
    const { body } = await getData([newSlotItem])

    expect(body.data.order_items[0]).toMatchObject({
      ac_unit_id: null,
      ac_units: null,
      brand_id: 'brand-panasonic',
      brand: 'Panasonic',
      unit_type_id: 'ut-cassette',
      unit_type_name: 'Cassette',
      capacity_id: 'cap-2pk',
      capacity_label: '2 PK',
      catalog_id: 'cat-install',
      msn_code: 'MSN-INSTALL',
      service_type_id: 'svc-install',
      service_catalog: { service_name: 'Pasang AC Cassette 2 PK', base_price: 500000 },
    })
  })

  it('keeps mixed orders deterministic by order_items.ac_unit_id', async () => {
    const { body } = await getData([completeExistingItem, newSlotItem, incompleteExistingItem])

    expect(body.data.order_items.map((item: { ac_unit_id: string | null }) => item.ac_unit_id)).toEqual([
      'ac-1',
      null,
      'ac-incomplete',
    ])
    expect(body.data.order_items.map((item: { ac_units: unknown }) => item.ac_units === null)).toEqual([
      false,
      true,
      false,
    ])
  })

  it('fails explicitly when existing AC belongs to another customer', async () => {
    const { response, body } = await getData([
      {
        ...completeExistingItem,
        ac_units: { ...completeExistingItem.ac_units, customer_id: 'customer-other' },
      },
    ])

    expect(response.status).toBe(500)
    expect(body.error).toContain('different customer')
  })

  it('fails explicitly when existing AC belongs to another location', async () => {
    const { response, body } = await getData([
      {
        ...completeExistingItem,
        ac_units: { ...completeExistingItem.ac_units, location_id: 'loc-other' },
      },
    ])

    expect(response.status).toBe(500)
    expect(body.error).toContain('different location')
  })
})
