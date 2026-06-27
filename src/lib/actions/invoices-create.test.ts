import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const createAdminClientMock = vi.fn()
const generateInvoiceNumberMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({ createClient: () => createClientMock() }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: () => createAdminClientMock() }))
vi.mock('@/lib/rbac', () => ({ requireFinanceRole: vi.fn(() => Promise.resolve()) }))
vi.mock('./invoices-queries', () => ({ generateInvoiceNumber: () => generateInvoiceNumberMock() }))
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { createBlankInvoice } from './invoices-create'
import type { CreateBlankInvoiceInput } from '@/app/api/schemas'

type Operation = { readonly table: string; readonly action: 'insert'; readonly payload: unknown }

const BLANK_INVOICE_BASE: CreateBlankInvoiceInput = {
  invoice_type: 'FINAL',
  customer_name: 'Budi',
  due_date: '2026-07-15',
  items: [{ item_type: 'BASE_SERVICE', description: 'Service AC', quantity: 1, unit_price: 250000 }],
}

function makeInvoiceClient(operations: Operation[]) {
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: table === 'invoice_configuration'
              ? { default_tax_percentage: 11, terms_conditions_template: null }
              : null,
            error: null,
          })),
        })),
      })),
      insert: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'insert', payload })
        if (table === 'invoices') {
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { invoice_id: 'invoice-1', status: 'DRAFT' }, error: null })),
            })),
          }
        }
        return Promise.resolve({ error: null })
      }),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      rpc: vi.fn(() => Promise.resolve({ data: 'INV-001', error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: 'INV-001', error: null })),
  }
}

describe('createBlankInvoice coordinate payload', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createAdminClientMock.mockReset()
    generateInvoiceNumberMock.mockResolvedValue('INV-001')
    createAdminClientMock.mockReturnValue({ from: vi.fn() })
  })

  it('maps customer_lat/customer_lng to DB override fields when provided', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeInvoiceClient(operations))

    const result = await createBlankInvoice({ ...BLANK_INVOICE_BASE, customer_lat: -6.2, customer_lng: 106.8 })

    expect(result.success).toBe(true)
    expect(operations.find(op => op.table === 'invoices')?.payload)
      .toMatchObject({ customer_lat_override: -6.2, customer_lng_override: 106.8 })
  })

  it('writes null coordinate override fields when blank invoice coordinates are omitted', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeInvoiceClient(operations))

    const result = await createBlankInvoice(BLANK_INVOICE_BASE)

    expect(result.success).toBe(true)
    expect(operations.find(op => op.table === 'invoices')?.payload)
      .toMatchObject({ customer_lat_override: null, customer_lng_override: null })
  })
})
