import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { CreateCustomerSchema, UpdateCustomerSchema } from './customers'

const VALID_CUSTOMER = {
  customerName: 'Budi Santoso',
  phoneNumber: '08123456789',
}

describe('customer coordinate schemas', () => {
  it('accept optional, nullable, and in-range lat/lng values', () => {
    expect(CreateCustomerSchema.parse(VALID_CUSTOMER)).not.toHaveProperty('lat')
    expect(
      CreateCustomerSchema.parse({ ...VALID_CUSTOMER, lat: null, lng: null })
    ).toMatchObject({ lat: null, lng: null })
    expect(UpdateCustomerSchema.parse({
      ...VALID_CUSTOMER,
      customerId: '11111111-1111-4111-8111-111111111111',
      lat: -6.2,
      lng: 106.8,
    })).toMatchObject({ lat: -6.2, lng: 106.8 })
  })

  it('rejects out-of-range coordinate values with range issues', () => {
    expect(() =>
      CreateCustomerSchema.parse({ ...VALID_CUSTOMER, lat: 200, lng: 181 })
    ).toThrow(ZodError)

    const result = CreateCustomerSchema.safeParse({ ...VALID_CUSTOMER, lat: 200, lng: 181 })

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

describe('CreateCustomerSchema geo validation', () => {
  const baseCustomer = {
    customerName: 'Test Customer',
    whatsappNumber: "08123456789", phoneNumber: "08123456789",
    address: 'Test Address',
    type: 'PERSONAL',
  }

  it('accepts null coordinates', () => {
    const result = CreateCustomerSchema.safeParse({ ...baseCustomer, lat: null, lng: null })
    expect(result.success).toBe(true)
  })

  it('accepts valid coordinates', () => {
    const result = CreateCustomerSchema.safeParse({ ...baseCustomer, lat: -6.2, lng: 106.8 })
    expect(result.success).toBe(true)
  })

  it('rejects coordinates out of bounds', () => {
    const result1 = CreateCustomerSchema.safeParse({ ...baseCustomer, lat: -91, lng: 106.8 })
    expect(result1.success).toBe(false)
    
    const result2 = CreateCustomerSchema.safeParse({ ...baseCustomer, lat: -6.2, lng: 181 })
    expect(result2.success).toBe(false)
  })
})
