import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

vi.mock('@/lib/audit', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { createCustomer, updateCustomer } from './customers'

type Operation = { readonly table: string; readonly action: 'insert' | 'update'; readonly payload: unknown }

function makeCustomerClient(operations: Operation[]) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      })),
      insert: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'insert', payload })
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { customer_id: 'customer-1' }, error: null })),
          })),
        }
      }),
      update: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'update', payload })
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { customer_id: 'customer-1' }, error: null })),
            })),
          })),
        }
      }),
    })),
  }
}

describe('customer action coordinate payloads', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it('writes provided lat/lng when creating a customer', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCustomerClient(operations))

    const result = await createCustomer({
      customer_name: 'Budi',
      primary_contact_person: 'Budi',
      phone_number: '08123',
      email: 'budi@example.com',
      billing_address: 'Jl. Sudirman No. 1',
      lat: -6.2,
      lng: 106.8,
    })

    expect(result.success).toBe(true)
    expect(operations.find(op => op.action === 'insert')?.payload).toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('writes null lat/lng when creating a customer without coordinates', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCustomerClient(operations))

    await createCustomer({
      customer_name: 'Budi',
      primary_contact_person: 'Budi',
      phone_number: '08123',
      email: 'budi@example.com',
      billing_address: 'Jl. Sudirman No. 1',
    })

    expect(operations.find(op => op.action === 'insert')?.payload).toMatchObject({ lat: null, lng: null })
  })

  it('forwards provided lat/lng when updating a customer', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCustomerClient(operations))

    const result = await updateCustomer('customer-1', { lat: -6.2, lng: 106.8 })

    expect(result.success).toBe(true)
    expect(operations.find(op => op.action === 'update')?.payload).toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('preserves partial update semantics when customer coordinates are omitted', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeCustomerClient(operations))

    await updateCustomer('customer-1', { customer_name: 'Budi' })

    const payload = operations.find(op => op.action === 'update')?.payload
    expect(payload).toMatchObject({ customer_name: 'Budi' })
    expect(payload).not.toHaveProperty('lat')
    expect(payload).not.toHaveProperty('lng')
  })
})
