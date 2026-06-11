import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

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

function createSupabaseMock(results: Record<string, QueryResult>, rpc = vi.fn()) {
  const selects: Array<{ table: string; columns: string }> = []
  const client = {
    from: vi.fn((table: string) => new QueryBuilder(table, results, selects)),
    rpc,
    __selects: selects,
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

function request() {
  return new NextRequest('http://localhost/api/technician/jobs/order-1')
}

function postReportRequest(body: unknown) {
  return new NextRequest('http://localhost/api/technician/jobs/order-1/report', {
    method: 'POST',
    body: JSON.stringify(body),
  })
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

describe('POST /api/technician/jobs/[orderId]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const idempotencyKey = '11111111-1111-4111-8111-111111111111'
  const reportPayload = {
    idempotency_key: idempotencyKey,
    photos_before: [],
    photos_after: [],
    materials: [],
    actual_total_price: 150000,
    customer_signature_url: '/signatures/order-1.png',
    customer_name_signed: 'Customer One',
    notes: 'Done',
    ac_units: [
      {
        ac_unit_id: 'ac-1',
        brand_id: '22222222-2222-4222-8222-222222222222',
        unit_type_id: '33333333-3333-4333-8333-333333333333',
        capacity_id: '44444444-4444-4444-8444-444444444444',
        room_location: 'Tampered Room',
        photos_before: [],
        photos_after: [],
        materials_used: [],
      },
    ],
  }

  function mockReportPost(rpc = vi.fn(async () => ({ data: 'report-1', error: null }))) {
    return createSupabaseMock(
      {
        order_technicians: { data: { role: 'lead' }, error: null },
        service_reports: { data: null, error: null },
        orders: { data: { status: 'IN_PROGRESS' }, error: null },
      },
      rpc
    )
  }

  it('requires idempotency_key before calling the report RPC', async () => {
    const rpc = vi.fn()
    mockReportPost(rpc)

    const response = await POST(
      postReportRequest({ ...reportPayload, idempotency_key: undefined }),
      { params: Promise.resolve({ id: ['order-1', 'report'] }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid input')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('passes the same idempotency_key through the direct report route to the RPC payload', async () => {
    const rpc = vi.fn(async () => ({ data: 'report-1', error: null }))
    mockReportPost(rpc)

    const response = await POST(postReportRequest(reportPayload), {
      params: Promise.resolve({ id: ['order-1', 'report'] }),
    })

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('technician_submit_report_v2', {
      p_order_id: 'order-1',
      p_technician_id: 'tech-1',
      p_payload: expect.objectContaining({ idempotency_key: idempotencyKey }),
      p_work_duration_minutes: null,
    })
  })

  it('preserves catalog and manual addon fields in report payload snapshots', async () => {
    const rpc = vi.fn(async () => ({ data: 'report-1', error: null }))
    mockReportPost(rpc)

    const catalogAddonId = '55555555-5555-4555-8555-555555555555'
    const response = await POST(
      postReportRequest({
        ...reportPayload,
        materials: [
          {
            addon_id: catalogAddonId,
            name: 'Filter Drier',
            qty: 2,
            unit_price: 50000,
            total: 100000,
            category: 'PARTS',
            unit_of_measure: 'pcs',
            is_manual: false,
          },
          {
            addon_id: null,
            name: 'Custom Bracket',
            qty: 1,
            unit_price: 25000,
            total: 25000,
            category: 'PARTS',
            unit_of_measure: 'pcs',
            description: 'Non-standard size',
            is_manual: true,
          },
        ],
        ac_units: [
          {
            ...reportPayload.ac_units[0],
            materials_used: [
              {
                addon_id: catalogAddonId,
                name: 'Filter Drier',
                qty: 2,
                unit_price: 50000,
                total: 100000,
                category: 'PARTS',
                unit_of_measure: 'pcs',
                is_manual: false,
              },
              {
                addon_id: null,
                name: 'Custom Bracket',
                qty: 1,
                unit_price: 25000,
                total: 25000,
                category: 'PARTS',
                unit_of_measure: 'pcs',
                description: 'Non-standard size',
                is_manual: true,
              },
            ],
          },
        ],
      }),
      { params: Promise.resolve({ id: ['order-1', 'report'] }) }
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('technician_submit_report_v2', {
      p_order_id: 'order-1',
      p_technician_id: 'tech-1',
      p_payload: expect.objectContaining({
        materials: expect.arrayContaining([
          expect.objectContaining({ addon_id: catalogAddonId, is_manual: false }),
          expect.objectContaining({ addon_id: null, is_manual: true }),
        ]),
        ac_units: [
          expect.objectContaining({
            materials_used: expect.arrayContaining([
              expect.objectContaining({ addon_id: catalogAddonId, name: 'Filter Drier', unit_price: 50000, qty: 2, total: 100000, category: 'PARTS', unit_of_measure: 'pcs', is_manual: false }),
              expect.objectContaining({ addon_id: null, name: 'Custom Bracket', unit_price: 25000, qty: 1, total: 25000, category: 'PARTS', unit_of_measure: 'pcs', description: 'Non-standard size', is_manual: true }),
            ]),
          }),
        ],
      }),
      p_work_duration_minutes: null,
    })
  })

  it('rejects a new AC payload missing required identity before RPC', async () => {
    const rpc = vi.fn()
    mockReportPost(rpc)

    const response = await POST(
      postReportRequest({
        ...reportPayload,
        ac_units: [{ photos_before: [], photos_after: [], materials_used: [], room_location: 'Bedroom' }],
      }),
      { params: Promise.resolve({ id: ['order-1', 'report'] }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('brand_id, unit_type_id, capacity_id, and room_location')
    expect(rpc).not.toHaveBeenCalled()
  })
})
