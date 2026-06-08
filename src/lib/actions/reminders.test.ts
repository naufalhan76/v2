import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const getUserMock = vi.fn()
const getUserRoleMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/lib/auth', () => ({
  getUser: () => getUserMock(),
  getUserRole: () => getUserRoleMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { getServicedAcUnits } from '@/lib/actions/reminders'

type QueryResult = { data: unknown[] | null; error: { message: string } | null }

function queryResult(data: unknown[] | null): QueryResult {
  return { data, error: null }
}

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'gte', 'lte', 'in']) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: unknown }).then = (
    onFulfilled: (value: QueryResult) => unknown
  ) => Promise.resolve(result).then(onFulfilled)
  return builder
}

function buildClient(results: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) => makeBuilder(results[table] ?? queryResult([]))),
  }
}

const servicedAcUnit = {
  ac_unit_id: 'ac-1',
  brand: 'Daikin',
  model_number: 'FTKQ25',
  ac_type: null,
  capacity_btu: 9000,
  last_service_date: '2026-06-01',
  next_service_due_date: '2026-09-01',
  location_id: 'loc-1',
  ac_brands: { name: 'Daikin' },
  unit_types: { name: 'Room Air' },
  locations: {
    location_id: 'loc-1',
    full_address: 'Jl. Merdeka',
    house_number: '10',
    city: 'Jakarta',
    customers: {
      customer_id: 'cust-1',
      customer_name: 'PT Sejuk',
      phone_number: '08123456789',
    },
  },
}

const servicedAcUnitWithoutLocation = {
  ...servicedAcUnit,
  ac_unit_id: 'ac-no-location',
  location_id: null,
  locations: null,
}

const servicedAcUnitMissingRelations = {
  ...servicedAcUnit,
  ac_unit_id: 'ac-missing',
  brand: null,
  model_number: null,
  location_id: null,
  ac_brands: null,
  unit_types: null,
  locations: null,
}

function orderItem(overrides: Record<string, unknown> = {}) {
  return {
    ac_unit_id: 'ac-1',
    service_type: null,
    status: null,
    service_types: null,
    orders: {
      status: 'COMPLETED',
      order_type: 'MAINTENANCE',
      created_at: '2026-06-03T09:00:00Z',
      customers: {
        customer_id: 'cust-order',
        customer_name: 'Order Customer',
        phone_number: '0899999999',
      },
    },
    ...overrides,
  }
}

describe('getServicedAcUnits monitoring columns', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    getUserMock.mockResolvedValue({ id: 'user-1' })
    getUserRoleMock.mockResolvedValue('ADMIN')
  })

  it('populates customer name and phone from AC location customer', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([orderItem()]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      customer_id: 'cust-1',
      customer_name: 'PT Sejuk',
      customer_phone: '08123456789',
    })
  })

  it('falls back to latest order customer when AC location is missing', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnitWithoutLocation]),
      customer_reminders: queryResult([]),
      order_items: queryResult([orderItem({ ac_unit_id: 'ac-no-location' })]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      customer_id: 'cust-order',
      customer_name: 'Order Customer',
      customer_phone: '0899999999',
    })
  })

  it('resolves service type from joined service_types name/code when service_type_id exists', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([
        orderItem({
          service_type: 'MAINTENANCE',
          service_types: { name: 'Deep Cleaning', code: 'DEEP_CLEAN' },
        }),
      ]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      latest_service_type: 'Deep Cleaning',
    })
  })

  it('uses order item service_type text when service_type_id join is missing', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([orderItem({ service_type: 'CLEANING', service_types: null })]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      latest_service_type: 'CLEANING',
    })
  })

  it('uses order status when order item status is null', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([orderItem({ status: null })]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      latest_order_status: 'COMPLETED',
    })
  })

  it('keeps customer, order status, and service type null when relational data is genuinely missing', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnitMissingRelations]),
      customer_reminders: queryResult([]),
      order_items: queryResult([
        {
          ac_unit_id: 'ac-missing',
          service_type: null,
          status: null,
          service_types: null,
          orders: {
            status: null,
            order_type: null,
            created_at: '2026-06-03T09:00:00Z',
            customers: null,
          },
        },
      ]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      customer_id: null,
      customer_name: null,
      customer_phone: null,
      latest_service_type: null,
      latest_order_status: null,
    })
  })

  it('does not use customer_reminders.status as service status', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnitMissingRelations]),
      customer_reminders: queryResult([
        { ac_unit_id: 'ac-missing', status: 'PENDING', sent_at: null },
      ]),
      order_items: queryResult([]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      has_pending_reminder: true,
      reminder_count: 1,
      latest_order_status: null,
    })
  })
})
