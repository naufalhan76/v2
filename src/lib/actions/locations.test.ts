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

import { updateLocation } from './locations'

function makeLocationClient(updates: unknown[]) {
  return {
    from: vi.fn(() => ({
      update: vi.fn((payload: unknown) => {
        updates.push(payload)
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { location_id: 'location-1' }, error: null })),
            })),
          })),
        }
      }),
    })),
  }
}

describe('updateLocation coordinate payload', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it('forwards provided lat/lng when updating a location', async () => {
    const updates: unknown[] = []
    createClientMock.mockResolvedValue(makeLocationClient(updates))

    const result = await updateLocation('location-1', { lat: -6.2, lng: 106.8 })

    expect(result.success).toBe(true)
    expect(updates[0]).toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('preserves partial update semantics when coordinates are omitted', async () => {
    const updates: unknown[] = []
    createClientMock.mockResolvedValue(makeLocationClient(updates))

    await updateLocation('location-1', { full_address: 'Jl. Sudirman No. 1' })

    expect(updates[0]).toMatchObject({ full_address: 'Jl. Sudirman No. 1' })
    expect(updates[0]).not.toHaveProperty('lat')
    expect(updates[0]).not.toHaveProperty('lng')
  })
})
