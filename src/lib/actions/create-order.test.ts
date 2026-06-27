import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { createLocation, createOrderWithItems } from './create-order-mutations'

type Operation = { table: string; action: string; payload?: unknown }

function makeCreateOrderClient(operations: Operation[]) {
  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })),
    },
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'insert', payload })

        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { order_id: 'order-1' }, error: null })),
            })),
          }
        }

        if (table === 'locations') {
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { location_id: 'location-1' }, error: null })),
            })),
          }
        }

        if (table === 'ac_units') {
          return {
            select: vi.fn(() => Promise.resolve({ data: [{ ac_unit_id: 'fabricated-ac-1' }], error: null })),
          }
        }

        return Promise.resolve({ error: null })
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  }
}

describe('createOrderWithItems AC identity contract', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it('keeps existing ac_unit_id, keeps new slots null, and does not create fake ac_units', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCreateOrderClient(operations))

    const result = await createOrderWithItems({
      customer_id: 'customer-1',
      scheduled_visit_date: '2026-06-10',
      items: [
        {
          location_id: 'location-1',
          ac_unit_id: 'ac-existing-1',
          unit_type_id: 'unit-wall',
          capacity_id: 'cap-1pk',
          service_type_id: 'svc-clean',
          catalog_id: 'cat-clean-wall-1pk',
          msn_code: 'MSN-CLEAN-1PK',
          service_type: 'CLEANING',
          estimated_price: 150000,
        },
        {
          location_id: 'location-1',
          ac_unit_id: null,
          new_ac_temp_id: 'new-slot-1',
          unit_type_id: 'unit-cassette',
          capacity_id: 'cap-2pk',
          brand_id: 'brand-daikin',
          service_type_id: 'svc-install',
          catalog_id: 'cat-install-cassette-2pk',
          msn_code: 'MSN-INSTALL-2PK',
          service_type: 'INSTALLATION',
          estimated_price: 450000,
          new_ac_data: {
            brand: 'TBD',
            model_number: 'TBD',
          },
        },
        {
          location_id: 'location-1',
          ac_unit_id: null,
          new_ac_temp_id: 'new-slot-1',
          unit_type_id: 'unit-cassette',
          capacity_id: 'cap-2pk',
          brand_id: 'brand-daikin',
          service_type_id: 'svc-maintain',
          catalog_id: 'cat-maintain-cassette-2pk',
          msn_code: 'MSN-MAINTAIN-2PK',
          service_type: 'MAINTENANCE',
          estimated_price: 250000,
          new_ac_data: {
            brand: 'TBD',
            model_number: 'TBD',
          },
        },
      ],
    })

    expect(result).toEqual({ success: true, data: { order_id: 'order-1' } })
    expect(operations).not.toContainEqual(expect.objectContaining({ table: 'ac_units', action: 'insert' }))

    const orderItemsInsert = operations.find(op => op.table === 'order_items' && op.action === 'insert')
    expect(orderItemsInsert?.payload).toEqual([
      expect.objectContaining({
        ac_unit_id: 'ac-existing-1',
        service_type_id: 'svc-clean',
        catalog_id: 'cat-clean-wall-1pk',
        msn_code: 'MSN-CLEAN-1PK',
      }),
      expect.objectContaining({
        ac_unit_id: null,
        service_type_id: 'svc-install',
        catalog_id: 'cat-install-cassette-2pk',
        msn_code: 'MSN-INSTALL-2PK',
      }),
      expect.objectContaining({
        ac_unit_id: null,
        service_type_id: 'svc-maintain',
        catalog_id: 'cat-maintain-cassette-2pk',
        msn_code: 'MSN-MAINTAIN-2PK',
      }),
    ])
  })
})

describe('create-order inline location coordinates', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it('forwards provided lat/lng when creating a new location inline', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCreateOrderClient(operations))

    const result = await createLocation({
      customer_id: 'customer-1',
      full_address: 'Jl. Sudirman No. 1',
      lat: -6.2,
      lng: 106.8,
    })

    expect(result).toEqual({ success: true, data: { location_id: 'location-1' } })
    expect(operations.find(op => op.table === 'locations' && op.action === 'insert')?.payload)
      .toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('writes null lat/lng when inline location coordinates are omitted', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCreateOrderClient(operations))

    await createLocation({ customer_id: 'customer-1', full_address: 'Jl. Sudirman No. 1' })

    expect(operations.find(op => op.table === 'locations' && op.action === 'insert')?.payload)
      .toMatchObject({ lat: null, lng: null })
  })
})
