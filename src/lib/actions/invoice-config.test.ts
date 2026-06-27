import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const requireFinanceRoleMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({ createClient: () => createClientMock() }))
vi.mock('@/lib/rbac', () => ({ requireFinanceRole: (user: unknown) => requireFinanceRoleMock(user) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { updateInvoiceConfig } from './invoice-config'

type Operation = { readonly table: string; readonly action: 'insert' | 'update'; readonly payload: unknown }

function makeInvoiceConfigClient(operations: Operation[], existingConfig: { readonly config_id: string } | null) {
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: existingConfig, error: existingConfig ? null : { code: 'PGRST116' } })),
        })),
      })),
      update: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'update', payload })
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { config_id: 'config-1' }, error: null })),
            })),
          })),
        }
      }),
      insert: vi.fn((payload: unknown) => {
        operations.push({ table, action: 'insert', payload })
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { config_id: 'config-1' }, error: null })),
          })),
        }
      }),
    })),
  }
}

describe('updateInvoiceConfig coordinate payload', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    requireFinanceRoleMock.mockResolvedValue(undefined)
  })

  it('maps companyLat/companyLng to DB columns when provided', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeInvoiceConfigClient(operations, { config_id: 'config-1' }))

    await updateInvoiceConfig({ company_name: 'PT AC', companyLat: -6.2, companyLng: 106.8 })

    expect(operations.find(op => op.action === 'update')?.payload)
      .toMatchObject({ company_lat: -6.2, company_lng: 106.8 })
  })

  it('writes null company coordinates when omitted', async () => {
    const operations: Operation[] = []
    createClientMock.mockResolvedValue(makeInvoiceConfigClient(operations, null))

    await updateInvoiceConfig({ company_name: 'PT AC' })

    expect(operations.find(op => op.action === 'insert')?.payload)
      .toMatchObject({ company_lat: null, company_lng: null })
  })
})
