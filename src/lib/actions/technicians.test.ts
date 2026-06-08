import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { getTechnicianAvailability } from './technicians'

function makeBuilder(result: { data: unknown[]; error: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('getTechnicianAvailability service records mapping', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('counts active services from related order status instead of legacy service_records.status', async () => {
    const builder = makeBuilder({
      data: [
        {
          technician_id: 'tech-1',
          technician_name: 'Budi',
          contact_number: '0812',
          service_records: [
            {
              service_id: 'svc-1',
              service_date: '2026-06-09',
              orders: { status: 'SCHEDULED' },
            },
            {
              service_id: 'svc-2',
              service_date: '2026-06-09',
              orders: { status: 'COMPLETED' },
            },
          ],
        },
      ],
      error: null,
    })
    const client = { from: vi.fn(() => builder) }
    createClientMock.mockResolvedValue(client)

    const result = await getTechnicianAvailability('2026-06-09')

    expect(result.success).toBe(true)
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining('service_date,\n          status'))
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('orders ('))
    expect(result.data).toEqual([
      {
        technician_id: 'tech-1',
        technician_name: 'Budi',
        contact_number: '0812',
        activeServices: 1,
        isAvailable: true,
      },
    ])
  })
})
