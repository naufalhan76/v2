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

describe('getServicedAcUnits monitoring columns', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    getUserMock.mockResolvedValue({ id: 'user-1' })
    getUserRoleMock.mockResolvedValue('ADMIN')
  })

  it('maps customer, service type, and status from the latest order item/order source data', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([
        {
          ac_unit_id: 'ac-1',
          service_type: null,
          status: null,
          orders: {
            status: 'COMPLETED',
            order_type: 'MAINTENANCE',
            created_at: '2026-06-03T09:00:00Z',
          },
        },
      ]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      customer_name: 'PT Sejuk',
      latest_service_type: 'MAINTENANCE',
      latest_order_status: 'COMPLETED',
    })
  })

  it('uses deterministic em dash fallbacks when service type and status are missing', async () => {
    const client = buildClient({
      ac_units: queryResult([servicedAcUnit]),
      customer_reminders: queryResult([]),
      order_items: queryResult([
        {
          ac_unit_id: 'ac-1',
          service_type: null,
          status: null,
          orders: {
            status: null,
            order_type: null,
            created_at: '2026-06-03T09:00:00Z',
          },
        },
      ]),
    })
    createClientMock.mockResolvedValue(client)

    const result = await getServicedAcUnits()

    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      latest_service_type: '—',
      latest_order_status: '—',
    })
  })
})
