import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClientMock,
  createAdminClientMock,
  generateInvoiceNumberMock,
  authMock,
  getInvoiceSourceMock,
  assertCustomerIsVisibleOrThrowMock,
  assertCustomerExistsForBlankInvoiceOrThrowMock,
  getInvoiceConfigMock,
  requireFinanceRoleMock,
  auditLogMock,
  revalidatePathMock,
  loggerMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  generateInvoiceNumberMock: vi.fn(),
  authMock: vi.fn(() => Promise.resolve({ userId: 'user-1' })),
  getInvoiceSourceMock: vi.fn((inv: { source?: string | null }) => inv.source ?? 'ORDER_LINKED'),
  assertCustomerIsVisibleOrThrowMock: vi.fn(() => Promise.resolve()),
  assertCustomerExistsForBlankInvoiceOrThrowMock: vi.fn(() => Promise.resolve()),
  getInvoiceConfigMock: vi.fn(() => Promise.resolve({ default_tax_percentage: 11, terms_conditions_template: null, default_due_days: 30 })),
  requireFinanceRoleMock: vi.fn(() => Promise.resolve()),
  auditLogMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  loggerMock: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))
vi.mock('@/lib/supabase-server', () => ({ createClient: () => createClientMock() }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: () => createAdminClientMock() }))
vi.mock('@/lib/rbac', () => ({ requireFinanceRole: requireFinanceRoleMock }))
vi.mock('./invoices-queries', () => ({ generateInvoiceNumber: () => generateInvoiceNumberMock() }))
vi.mock('@/lib/audit', () => ({ auditLog: auditLogMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/invoice-utils', () => ({ getInvoiceSource: getInvoiceSourceMock }))
vi.mock('./invoices-revision', () => ({
  assertCustomerIsVisibleOrThrow: assertCustomerIsVisibleOrThrowMock,
  assertCustomerExistsForBlankInvoiceOrThrow: assertCustomerExistsForBlankInvoiceOrThrowMock,
}))
vi.mock('@/lib/actions/invoice-config', () => ({ getInvoiceConfig: getInvoiceConfigMock }))

import { createInvoice, createBlankInvoice } from './invoices-create'
import type { CreateInvoiceInput } from './invoices-types'
import type { CreateBlankInvoiceInput } from '@/app/api/schemas'

type Operation = { readonly table: string; readonly action: 'insert'; readonly payload: unknown }

const BLANK_INVOICE_BASE: CreateBlankInvoiceInput = {
  invoice_type: 'FINAL',
  customer_name: 'Budi',
  due_date: '2026-07-15',
  items: [{ item_type: 'BASE_SERVICE', description: 'Service AC', quantity: 1, unit_price: 250000 }],
}

const INVOICE_BASE: CreateInvoiceInput = {
  order_id: 'order-1',
  customer_id: 'customer-1',
  invoice_type: 'PROFORMA',
  due_date: '2026-07-15',
  service_type: 'AC_SERVICE',
  service_name: 'Service AC',
  base_service_price: 250000,
  items: [
    { item_type: 'BASE_SERVICE', description: 'Service AC', quantity: 1, unit_price: 250000 },
    { item_type: 'ADDON', description: 'Filter', quantity: 2, unit_price: 50000 },
  ],
}

// --- Mock factories ---

/** Used by createBlankInvoice tests: records all insert payloads per table. */
function makeBlankClient(operations: Operation[]) {
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
      insert: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'insert', payload })
        if (table === 'invoices') {
          return { select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { invoice_id: 'invoice-1', status: 'DRAFT' }, error: null })) })) }
        }
        return Promise.resolve({ error: null })
      }),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      rpc: vi.fn(() => Promise.resolve({ data: 'INV-001', error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: 'INV-001', error: null })),
  }
}

/** Used by createInvoice tests: captures order mock + insert payloads + allows error injection. */
function makeInvoiceClient(
  orderData: { order_id: string; customer_id: string; status: string } | null,
  opts: { insertItemsError?: { message: string } } = {}
) {
  const capturedInvoiceInsert: Record<string, unknown> = {}
  const updateOrdersMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }))
  const deleteInvoicesMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))

  const from = vi.fn((table: string) => {
    if (table === 'invoice_configuration') {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { default_due_days: 30, terms_conditions_template: 'T&C' }, error: null })) })) })) }
    }
    if (table === 'orders') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: orderData, error: null })),
            single: vi.fn(() => Promise.resolve({ data: orderData, error: null })),
          })),
        })),
        update: updateOrdersMock,
      }
    }
    if (table === 'invoices') {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          Object.assign(capturedInvoiceInsert, payload)
          return { select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { invoice_id: 'invoice-1', invoice_number: 'INV-001' }, error: null })) })) }
        }),
        delete: deleteInvoicesMock,
      }
    }
    if (table === 'invoice_items') {
      return { insert: vi.fn(() => Promise.resolve({ error: opts.insertItemsError ?? null })) }
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) }
  })

  return { from, updateOrdersMock, deleteInvoicesMock, capturedInvoiceInsert }
}

function resetMocks() {
  createClientMock.mockReset()
  createAdminClientMock.mockReset()
  generateInvoiceNumberMock.mockReset()
  authMock.mockReset()
  getInvoiceSourceMock.mockReset()
  assertCustomerIsVisibleOrThrowMock.mockReset()
  assertCustomerExistsForBlankInvoiceOrThrowMock.mockReset()
  getInvoiceConfigMock.mockReset()
  requireFinanceRoleMock.mockReset()
  auditLogMock.mockReset()
  revalidatePathMock.mockReset()
  generateInvoiceNumberMock.mockResolvedValue('INV-001')
  authMock.mockResolvedValue({ userId: 'user-1' })
  getInvoiceSourceMock.mockImplementation((inv: { source?: string | null }) => inv.source ?? 'ORDER_LINKED')
  assertCustomerIsVisibleOrThrowMock.mockResolvedValue(undefined)
  assertCustomerExistsForBlankInvoiceOrThrowMock.mockResolvedValue(undefined)
  getInvoiceConfigMock.mockResolvedValue({ default_tax_percentage: 11, terms_conditions_template: null, default_due_days: 30 })
  requireFinanceRoleMock.mockResolvedValue(undefined)
  createAdminClientMock.mockReturnValue({ from: vi.fn() })
}

// --- Tests ---

describe('createBlankInvoice coordinate payload', () => {
  beforeEach(() => resetMocks())

  it('maps customer_lat/customer_lng to DB override fields when provided', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    const result = await createBlankInvoice({ ...BLANK_INVOICE_BASE, customer_lat: -6.2, customer_lng: 106.8 })

    expect(result.success).toBe(true)
    expect(operations.find(op => op.table === 'invoices')?.payload)
      .toMatchObject({ customer_lat_override: -6.2, customer_lng_override: 106.8 })
  })

  it('writes null coordinate override fields when blank invoice coordinates are omitted', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    const result = await createBlankInvoice(BLANK_INVOICE_BASE)

    expect(result.success).toBe(true)
    expect(operations.find(op => op.table === 'invoices')?.payload)
      .toMatchObject({ customer_lat_override: null, customer_lng_override: null })
  })
})

describe('createBlankInvoice', () => {
  beforeEach(() => resetMocks())

  it('returns success with invoice data on happy path', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    const result = await createBlankInvoice(BLANK_INVOICE_BASE)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.invoice_id).toBe('invoice-1')
      expect(result.data.source).toBe('BLANK')
    }
  })

  it('inserts line items into invoice_items', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    await createBlankInvoice(BLANK_INVOICE_BASE)

    const itemsOp = operations.find(op => op.table === 'invoice_items')
    expect(itemsOp).toBeDefined()
    const items = itemsOp!.payload as Array<{ description: string }>
    expect(items).toHaveLength(1)
    expect(items[0].description).toBe('Service AC')
  })

  it('suppresses phone/email/address overrides when customer_id is provided', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    await createBlankInvoice({
      ...BLANK_INVOICE_BASE,
      customer_id: 'cust-123',
      customer_phone: '08123456789',
      customer_email: 'budi@test.com',
      customer_address: 'Jl. Sudirman',
    })

    const inv = operations.find(op => op.table === 'invoices')?.payload as Record<string, unknown>
    expect(inv.customer_phone_override).toBeNull()
    expect(inv.customer_email_override).toBeNull()
    expect(inv.customer_address_override).toBeNull()
  })

  it('stores phone/email/address overrides when customer_id is NOT provided', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeBlankClient(operations))

    await createBlankInvoice({
      ...BLANK_INVOICE_BASE,
      customer_phone: '08123456789',
      customer_email: 'budi@test.com',
      customer_address: 'Jl. Sudirman',
    })

    const inv = operations.find(op => op.table === 'invoices')?.payload as Record<string, unknown>
    expect(inv.customer_phone_override).toBe('08123456789')
    expect(inv.customer_email_override).toBe('budi@test.com')
    expect(inv.customer_address_override).toBe('Jl. Sudirman')
  })

  it('rolls back invoice when invoice_items insert fails and returns error', async () => {
    const deleteMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
    const from = vi.fn((table: string) => {
      if (table === 'invoices') {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { invoice_id: 'invoice-1' }, error: null })) })) })),
          delete: deleteMock,
        }
      }
      if (table === 'invoice_items') {
        return { insert: vi.fn(() => Promise.resolve({ error: { message: 'FK violation' } })) }
      }
      return makeBlankClient([]).from(table)
    })
    createClientMock.mockResolvedValue({ ...makeBlankClient([]), from })

    const result = await createBlankInvoice(BLANK_INVOICE_BASE)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/invoice items|invoice/i)
    expect(deleteMock).toHaveBeenCalled()
  })

  it('returns categorised error when Supabase config is missing', async () => {
    assertCustomerExistsForBlankInvoiceOrThrowMock.mockRejectedValueOnce(
      new Error('Missing Supabase URL or Service Role Key')
    )
    createClientMock.mockResolvedValue(makeBlankClient([]))

    const result = await createBlankInvoice(BLANK_INVOICE_BASE)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Konfigurasi server')
  })
})

describe('createInvoice', () => {
  beforeEach(() => resetMocks())

  it('creates invoice and items on happy path (PROFORMA)', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    const result = await createInvoice(INVOICE_BASE)

    expect(result.invoice_id).toBe('invoice-1')
    expect(getInvoiceSourceMock).toHaveBeenCalled()
  })

  it('throws when order is not found', async () => {
    const client = makeInvoiceClient(null)
    createClientMock.mockResolvedValue(client)

    await expect(createInvoice(INVOICE_BASE)).rejects.toThrow('Order tidak valid atau tidak ditemukan')
  })

  it('throws when order customer_id does not match input customer_id', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'wrong-customer', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    await expect(createInvoice(INVOICE_BASE)).rejects.toThrow('Order tidak sesuai dengan customer yang dipilih')
  })

  it('throws when order status is not DONE or COMPLETED', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'IN_PROGRESS' })
    createClientMock.mockResolvedValue(client)

    await expect(createInvoice(INVOICE_BASE)).rejects.toThrow('Order belum memenuhi syarat untuk pembuatan invoice')
  })

  it('rolls back invoice when invoice_items insert fails', async () => {
    const client = makeInvoiceClient(
      { order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' },
      { insertItemsError: { message: 'FK violation' } }
    )
    createClientMock.mockResolvedValue(client)

    await expect(createInvoice(INVOICE_BASE)).rejects.toThrow('Gagal membuat invoice items')
    expect(client.deleteInvoicesMock).toHaveBeenCalled()
  })

  it('updates order to INVOICED when invoice_type is FINAL and order is COMPLETED', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    await createInvoice({ ...INVOICE_BASE, invoice_type: 'FINAL' })

    expect(client.updateOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'INVOICED', updated_at: expect.any(String) })
    )
  })

  it('does NOT update order status when invoice_type is PROFORMA', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    await createInvoice({ ...INVOICE_BASE, invoice_type: 'PROFORMA' })

    expect(client.updateOrdersMock).not.toHaveBeenCalled()
  })

  it('computes subtotal, tax, and total correctly', async () => {
    // base_service=250_000, addons=2*50_000=100_000, subtotal=350_000
    // discount=50_000, taxable=300_000, tax@10%=30_000, total=330_000
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    await createInvoice({ ...INVOICE_BASE, discount_amount: 50000, tax_percentage: 10 })

    const p = client.capturedInvoiceInsert
    expect(p.subtotal).toBe(350000)
    expect(p.discount_amount).toBe(50000)
    expect(p.tax_amount).toBe(30000)
    expect(p.total_amount).toBe(330000)
  })

  it('treats tax_percentage: 0 as zero, not default 11', async () => {
    const client = makeInvoiceClient({ order_id: 'order-1', customer_id: 'customer-1', status: 'COMPLETED' })
    createClientMock.mockResolvedValue(client)

    await createInvoice({ ...INVOICE_BASE, tax_percentage: 0 })

    const p = client.capturedInvoiceInsert
    // subtotal=350_000, taxable=350_000, tax@0%=0, total=350_000
    expect(p.tax_amount).toBe(0)
    expect(p.total_amount).toBe(350000)
  })
})
