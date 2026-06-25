import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getServiceReport } from '../service-report'
import { createClient } from '../supabase-server'

vi.mock('../supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

function mockCreateSignedUrl(signedUrlMap: Record<string, string>) {
  return vi.fn(async (path: string) => {
    const signedUrl = signedUrlMap[path]
    if (signedUrl) {
      return { data: { signedUrl }, error: null }
    }
    return { data: null, error: new Error('not found') }
  })
}

describe('getServiceReport photo re-sign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-signs storage paths to signed URLs', async () => {
    const dbRow = {
      report_id: 'rpt-1',
      order_id: 'ORD-001',
      technician_id: 'tech-1',
      photos_before: ['ORD-001/before1.jpg', 'ORD-001/before2.jpg'],
      photos_after: ['ORD-001/after1.jpg'],
      materials: [],
      actual_total_price: 0,
      customer_signature_url: null,
      customer_name_signed: null,
      signed_at: null,
      notes: null,
      work_started_at: null,
      work_completed_at: null,
      submitted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      technicians: null,
    }

    const createSignedUrl = mockCreateSignedUrl({
      'ORD-001/before1.jpg': 'https://signed.example.com/ORD-001/before1.jpg?token=abc',
      'ORD-001/before2.jpg': 'https://signed.example.com/ORD-001/before2.jpg?token=def',
      'ORD-001/after1.jpg': 'https://signed.example.com/ORD-001/after1.jpg?token=ghi',
    })

    const storageFrom = vi.fn(() => ({ createSignedUrl }))

    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: dbRow, error: null })),
    }

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => builder),
      storage: { from: storageFrom },
    } as never)

    const report = await getServiceReport('ORD-001')

    expect(createClient).toHaveBeenCalled()
    expect(report).not.toBeNull()
    expect(report!.photos_before).toEqual([
      'https://signed.example.com/ORD-001/before1.jpg?token=abc',
      'https://signed.example.com/ORD-001/before2.jpg?token=def',
    ])
    expect(report!.photos_after).toEqual([
      'https://signed.example.com/ORD-001/after1.jpg?token=ghi',
    ])
  })

  it('passes through already-http URLs unchanged', async () => {
    const dbRow = {
      report_id: 'rpt-2',
      order_id: 'ORD-002',
      technician_id: 'tech-1',
      photos_before: ['https://old.example.com/service-photos/ORD-002/old.jpg?token=xyz'],
      photos_after: [],
      materials: [],
      actual_total_price: 0,
      customer_signature_url: null,
      customer_name_signed: null,
      signed_at: null,
      notes: null,
      work_started_at: null,
      work_completed_at: null,
      submitted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      technicians: null,
    }

    const createSignedUrl = vi.fn()

    const storageFrom = vi.fn(() => ({ createSignedUrl }))

    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: dbRow, error: null })),
    }

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => builder),
      storage: { from: storageFrom },
    } as never)

    const report = await getServiceReport('ORD-002')

    expect(report).not.toBeNull()
    expect(report!.photos_before).toEqual([
      'https://old.example.com/service-photos/ORD-002/old.jpg?token=xyz',
    ])
    expect(report!.photos_after).toEqual([])
    // createSignedUrl should never be called for http URLs
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('handles empty photo arrays', async () => {
    const dbRow = {
      report_id: 'rpt-3',
      order_id: 'ORD-003',
      technician_id: 'tech-1',
      photos_before: null,
      photos_after: null,
      materials: [],
      actual_total_price: 0,
      customer_signature_url: null,
      customer_name_signed: null,
      signed_at: null,
      notes: null,
      work_started_at: null,
      work_completed_at: null,
      submitted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      technicians: null,
    }

    const createSignedUrl = vi.fn()

    const storageFrom = vi.fn(() => ({ createSignedUrl }))

    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: dbRow, error: null })),
    }

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => builder),
      storage: { from: storageFrom },
    } as never)

    const report = await getServiceReport('ORD-003')

    expect(report).not.toBeNull()
    expect(report!.photos_before).toEqual([])
    expect(report!.photos_after).toEqual([])
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
