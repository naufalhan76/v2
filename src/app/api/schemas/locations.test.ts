import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { CreateLocationSchema, UpdateLocationSchema } from './locations'

const VALID_LOCATION = {
  customerId: '11111111-1111-4111-8111-111111111111',
  fullAddress: 'Jl. Sudirman No. 1',
}

describe('location coordinate schemas', () => {
  it('accept optional, nullable, and in-range lat/lng values', () => {
    expect(CreateLocationSchema.parse(VALID_LOCATION)).not.toHaveProperty('lat')
    expect(
      CreateLocationSchema.parse({ ...VALID_LOCATION, lat: null, lng: null })
    ).toMatchObject({ lat: null, lng: null })
    expect(UpdateLocationSchema.parse({
      ...VALID_LOCATION,
      locationId: '22222222-2222-4222-8222-222222222222',
      lat: -6.2,
      lng: 106.8,
    })).toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('rejects out-of-range coordinate values with range issues', () => {
    expect(() =>
      CreateLocationSchema.parse({ ...VALID_LOCATION, lat: 200, lng: 181 })
    ).toThrow(ZodError)

    const result = CreateLocationSchema.safeParse({ ...VALID_LOCATION, lat: 200, lng: 181 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'too_big', path: ['lat'] }),
          expect.objectContaining({ code: 'too_big', path: ['lng'] }),
        ])
      )
    }
  })
})

describe('CreateLocationSchema geo validation', () => {
  const baseLocation = {
    customerId: '123e4567-e89b-12d3-a456-426614174000',
    address: "Test Address", fullAddress: "Test Address",
  }

  it('accepts null coordinates', () => {
    const result = CreateLocationSchema.safeParse({ ...baseLocation, lat: null, lng: null })
    expect(result.success).toBe(true)
  })

  it('accepts valid coordinates', () => {
    const result = CreateLocationSchema.safeParse({ ...baseLocation, lat: -6.2, lng: 106.8 })
    expect(result.success).toBe(true)
  })

  it('rejects coordinates out of bounds', () => {
    const result1 = CreateLocationSchema.safeParse({ ...baseLocation, lat: -91, lng: 106.8 })
    expect(result1.success).toBe(false)
    
    const result2 = CreateLocationSchema.safeParse({ ...baseLocation, lat: -6.2, lng: 181 })
    expect(result2.success).toBe(false)
  })
})
