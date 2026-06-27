import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/app/api/middleware/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({ id: 'user-1' })),
}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })),
  },
}))

const { createClient } = await import('../../../../lib/supabase-server')
const { PUT } = await import('./route')

const customerId = '11111111-1111-4111-8111-111111111111'

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function params() {
  return { params: Promise.resolve({ id: customerId }) }
}

function mockSupabase() {
  let updatePayload: Record<string, unknown> | undefined
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'user_management') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'ADMIN' }, error: null }),
        }
      }

      return {
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { customer_id: customerId, ...payload }, error: null }),
          }
        }),
      }
    }),
    getUpdatePayload: () => updatePayload,
  }
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)
  return client
}

describe('PUT /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid coordinates before updating the database', async () => {
    const supabase = mockSupabase()

    const response = await PUT(
      request({
        customer_name: 'PT Test',
        primary_contact_person: 'Budi',
        phone_number: '08123',
        billing_address: 'Jl. Test',
        email: 'ops@example.com',
        lat: 200,
        lng: 181,
      }),
      params(),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).not.toContain('value too long')
    expect(supabase.getUpdatePayload()).toBeUndefined()
  })

  it('rejects malformed email before updating the database', async () => {
    const supabase = mockSupabase()

    const response = await PUT(
      request({
        customerName: 'PT Test',
        primaryContactPerson: 'Budi',
        phoneNumber: '08123',
        billingAddress: 'Jl. Test',
        email: 'not-an-email',
      }),
      params(),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(supabase.getUpdatePayload()).toBeUndefined()
  })

  it('normalizes existing snake_case bodies and forwards validated coordinates', async () => {
    const supabase = mockSupabase()

    const response = await PUT(
      request({
        customer_name: 'PT Test',
        primary_contact_person: 'Budi',
        phone_number: '08123',
        billing_address: 'Jl. Test',
        email: 'ops@example.com',
        notes: 'VIP',
        lat: -6.2,
        lng: 106.8,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(supabase.getUpdatePayload()).toMatchObject({
      customer_name: 'PT Test',
      primary_contact_person: 'Budi',
      phone_number: '08123',
      billing_address: 'Jl. Test',
      email: 'ops@example.com',
      notes: 'VIP',
      lat: -6.2,
      lng: 106.8,
    })
  })

  it('accepts camelCase schema bodies and maps them to DB columns', async () => {
    const supabase = mockSupabase()

    const response = await PUT(
      request({
        customerName: 'PT Camel',
        primaryContactPerson: 'Siti',
        phoneNumber: '08456',
        billingAddress: 'Jl. Camel',
        email: 'siti@example.com',
        lat: null,
        lng: null,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(supabase.getUpdatePayload()).toMatchObject({
      customer_name: 'PT Camel',
      primary_contact_person: 'Siti',
      phone_number: '08456',
      billing_address: 'Jl. Camel',
      email: 'siti@example.com',
      lat: null,
      lng: null,
    })
  })

  it('writes null coordinates when a valid update omits lat/lng', async () => {
    const supabase = mockSupabase()

    const response = await PUT(
      request({
        customerName: 'PT Null Coords',
        primaryContactPerson: 'Siti',
        phoneNumber: '08456',
        billingAddress: 'Jl. Null',
        email: 'siti@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(supabase.getUpdatePayload()).toMatchObject({ lat: null, lng: null })
  })
})
