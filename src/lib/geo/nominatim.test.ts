import { describe, expect, it, vi, beforeEach } from 'vitest'
import { searchAddress } from './nominatim'

describe('searchAddress', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    process.env.NEXT_PUBLIC_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
  })

  it('handles HTTP errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const controller = new AbortController()
    await expect(searchAddress('test', controller.signal)).rejects.toThrow('Nominatim API error: 500 Internal Server Error')
  })

  it('filters out results with invalid coordinate formats producing NaN', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { display_name: 'Valid', lat: '-6.200000', lon: '106.816666', place_id: 1 },
        { display_name: 'Invalid Lat', lat: 'invalid', lon: '106.816666', place_id: 2 },
        { display_name: 'Invalid Lon', lat: '-6.200000', lon: 'invalid', place_id: 3 },
      ]
    })

    const controller = new AbortController()
    const results = await searchAddress('test', controller.signal)

    expect(results).toHaveLength(1)
    expect(results[0].display_name).toBe('Valid')
  })
})
