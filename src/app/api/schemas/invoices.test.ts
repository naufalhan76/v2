import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { CreateBlankInvoiceSchema } from './invoices'

const VALID_BLANK_INVOICE = {
  customer_name: 'Budi Santoso',
  due_date: '2026-07-15',
  items: [{ description: 'Service AC', quantity: 1, unit_price: 250000 }],
}

describe('blank invoice customer coordinate schema', () => {
  it('accepts optional, nullable, and in-range customer coordinate values', () => {
    expect(CreateBlankInvoiceSchema.parse(VALID_BLANK_INVOICE)).not.toHaveProperty('customer_lat')
    expect(CreateBlankInvoiceSchema.parse({
      ...VALID_BLANK_INVOICE,
      customer_lat: null,
      customer_lng: null,
    })).toMatchObject({ customer_lat: null, customer_lng: null })
    expect(CreateBlankInvoiceSchema.parse({
      ...VALID_BLANK_INVOICE,
      customer_lat: -6.2,
      customer_lng: 106.8,
    })).toMatchObject({ customer_lat: -6.2, customer_lng: 106.8 })
  })

  it('rejects out-of-range customer coordinate values with range issues', () => {
    expect(() => CreateBlankInvoiceSchema.parse({
      ...VALID_BLANK_INVOICE,
      customer_lat: 200,
      customer_lng: 181,
    })).toThrow(ZodError)

    const result = CreateBlankInvoiceSchema.safeParse({
      ...VALID_BLANK_INVOICE,
      customer_lat: 200,
      customer_lng: 181,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'too_big', path: ['customer_lat'] }),
          expect.objectContaining({ code: 'too_big', path: ['customer_lng'] }),
        ])
      )
    }
  })
})

describe('CreateBlankInvoiceSchema geo validation', () => {
  const baseInvoice = {
    customerId: '123e4567-e89b-12d3-a456-426614174000',
    invoice_date: "2026-06-27T00:00:00Z",
    due_date: "2026-07-27T00:00:00Z",
    status: 'DRAFT',
    customer_name: "Test Name",
    customer_phone: "08123456789",
    customer_address: "Test Address",
    items: [{ serviceId: "test", name: "test", description: "test desc", quantity: 1, unit_price: 100, price: 100, subtotal: 100 }],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  }

  it('accepts null coordinates', () => {
    const result = CreateBlankInvoiceSchema.safeParse({ ...baseInvoice, customer_lat: null, customer_lng: null })
    expect(result.success).toBe(true)
  })

  it('accepts valid coordinates', () => {
    const result = CreateBlankInvoiceSchema.safeParse({ ...baseInvoice, customer_lat: -6.2, customer_lng: 106.8 })
    expect(result.success).toBe(true)
  })

  it('rejects coordinates out of bounds', () => {
    const result1 = CreateBlankInvoiceSchema.safeParse({ ...baseInvoice, customer_lat: -91, customer_lng: 106.8 })
    expect(result1.success).toBe(false)
    
    const result2 = CreateBlankInvoiceSchema.safeParse({ ...baseInvoice, customer_lat: -6.2, customer_lng: 181 })
    expect(result2.success).toBe(false)
  })
})
