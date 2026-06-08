import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  getUserRole: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { getAcUnitById } from './ac-units'

function makeSingleBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('getAcUnitById service records mapping', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('selects legacy service_records columns and maps status from related orders', async () => {
    const builder = makeSingleBuilder({
      data: {
        ac_unit_id: 'ac-1',
        service_records: [
          {
            service_id: 'svc-1',
            order_id: 'ord-1',
            service_date: '2026-06-01',
            service_type: 'CLEANING',
            cost: 150000,
            next_service_due: '2026-09-01',
            orders: { status: 'COMPLETED' },
          },
        ],
      },
      error: null,
    })
    const client = { from: vi.fn(() => builder) }
    createClientMock.mockResolvedValue(client)

    const result = await getAcUnitById('ac-1')

    expect(result.success).toBe(true)
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('findings'))
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('actions_taken'))
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('parts_used'))
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringMatching(/\n\s*status,\n/))
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('orders ('))
    expect(result.data?.service_records?.[0]).toMatchObject({
      service_id: 'svc-1',
      status: 'COMPLETED',
    })
    expect(result.data?.service_records?.[0]).not.toHaveProperty('orders')
  })
})
