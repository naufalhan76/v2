import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { JobCompletionWizard } from '@/components/technician/job-completion-wizard'
import type { LocalJobSnapshot } from '@/lib/offline/snapshot'
import { computeWorkDurationMinutes } from '@/lib/offline/time'

const snapshotStore = vi.hoisted(() => ({
  current: undefined as LocalJobSnapshot | undefined,
}))

vi.mock('@/lib/offline/snapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offline/snapshot')>()
  return {
    ...actual,
    getJobSnapshot: vi.fn(async () => snapshotStore.current),
  }
})

vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn(async () => ({ data: { technician_id: 'tech-1' } })),
        }),
      }),
    }),
  }),
}))

// Mocking Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

vi.mock('@/components/technician/signature-pad', () => ({
  SignaturePad: () => <div data-testid="signature-pad" />,
}))

function makeSnapshot(overrides: Partial<LocalJobSnapshot> = {}): LocalJobSnapshot {
  return {
    orderId: 'WO-OFFLINE-001',
    status: 'IN_PROGRESS',
    customer: {
      name: 'Budi Offline',
      address: 'Jl. Cache No. 1',
    },
    scheduledDate: '2026-06-11T10:00:00.000Z',
    orderItems: [
      {
        id: 'item-1',
        serviceType: 'Service AC',
        acUnitId: 'ac-1',
        acUnit: {
          id: 'ac-1',
          brand: 'Daikin',
          brandId: '11111111-1111-4111-8111-111111111111',
          modelNumber: 'FTKQ',
          serialNumber: 'SN-1',
          installationDate: null,
          acType: null,
          unitTypeId: '22222222-2222-4222-8222-222222222222',
          capacityId: '33333333-3333-4333-8333-333333333333',
          capacityLabel: '1 PK',
          roomLocation: 'Kamar',
          floorLevel: '1',
          positionDetail: 'Dinding',
        },
      },
    ],
    technicianId: 'tech-1',
    syncedAt: Date.now() - 60000,
    locked: true,
    ...overrides,
  }
}

function stubFetch(serverName = 'Server Customer') {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/technician/dimensions')) {
      return { ok: true, json: async () => ({ success: true, data: { unit_types: [], capacity_ranges: [], ac_brands: [] } }) }
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          order_id: 'WO-OFFLINE-001',
          status: 'IN_PROGRESS',
          canonical_status: 'IN_PROGRESS',
          has_report: false,
          report_id: null,
          scheduled_visit_date: '2026-06-11T10:00:00.000Z',
          customers: { customer_name: serverName },
          order_items: [],
          order_technicians: [{ technician_id: 'tech-1', role: 'lead' }],
        },
      }),
    }
  }))
}

describe('Offline-First PWA Workflow (Red Baseline)', () => {
  beforeEach(() => {
    localStorage.clear()
    snapshotStore.current = undefined
    vi.unstubAllGlobals()
  })

  describe('1. Wizard Offline Snapshot Mount', () => {
    it('renders wizard from snapshot prop when network fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
      const mockSnapshot = makeSnapshot()

      render(<JobCompletionWizard orderId="WO-OFFLINE-001" snapshot={mockSnapshot} />)

      expect(await screen.findByText(/Budi Offline/i)).toBeInTheDocument()
      expect(screen.getByText(/Jl\. Cache No\. 1/i)).toBeInTheDocument()
      expect(screen.getByText(/Data Unit AC/i)).toBeInTheDocument()
    })

    it('reads cached snapshot first and hydrates server data in the background', async () => {
      snapshotStore.current = makeSnapshot()
      stubFetch('Server Customer')

      render(<JobCompletionWizard orderId="WO-OFFLINE-001" />)

      expect(await screen.findByText(/Budi Offline/i)).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText(/Server Customer/i)).toBeInTheDocument())
    })

    it('shows an actionable offline error when no snapshot is cached', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

      render(<JobCompletionWizard orderId="WO-MISSING-SNAPSHOT" />)

      expect(await screen.findByText('Tidak ada data offline untuk job ini')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeInTheDocument()

      vi.unstubAllGlobals()
    })
  })

  describe('2. Wizard Draft Persistence', () => {
    it('restores local draft on remount and does not let background hydrate overwrite it', async () => {
      snapshotStore.current = makeSnapshot()
      stubFetch('Server Customer')
      localStorage.setItem(
        'msn-erp-wizard-draft-WO-OFFLINE-001',
        JSON.stringify({
          customerNameSigned: 'Nama Draft Lokal',
          notes: '',
          nextServiceDate: '2026-09-11',
          nextServiceNotes: '',
          acUnits: [
            {
              ac_unit_id: 'ac-1',
              brand: 'Draft Brand',
              brand_id: '11111111-1111-4111-8111-111111111111',
              ac_type: '',
              unit_type_id: '22222222-2222-4222-8222-222222222222',
              capacity_id: '33333333-3333-4333-8333-333333333333',
              capacity_label: '1 PK',
              model_number: '',
              serial_number: '',
              room_location: 'Ruang Draft',
              floor_level: '1',
              position_detail: '',
              skipped: false,
              skip_reason: '',
              photos_before: ['before-photo-id'],
              photos_after: [],
              notes: '',
              materials_used: [],
            },
          ],
          currentStep: 2,
        })
      )

      render(<JobCompletionWizard orderId="WO-OFFLINE-001" />)

      expect(await screen.findByText('Draft dipulihkan')).toBeInTheDocument()
      expect(screen.getByText('Langkah 2 dari 4')).toBeInTheDocument()
      const signer = await screen.findByLabelText('Nama Penandatangan')
      expect(signer).toHaveValue('Nama Draft Lokal')
      await waitFor(() => expect(screen.getByText(/Server Customer/i)).toBeInTheDocument())
      expect(signer).toHaveValue('Nama Draft Lokal')
    })
  })

  describe('3. Timer Precheck Gate', () => {
    it.fails('[RED BASELINE] timer Start button is disabled until before photos and AC fields pass', () => {
      render(<JobCompletionWizard orderId="WO-OFFLINE-002" />)
      
      // The timer start button should be present
      const startTimerBtn = screen.getByRole('button', { name: /Mulai Waktu/i })
      
      // Initially disabled
      expect(startTimerBtn).toBeDisabled()
      
      // Should have some visual indicator of why it's disabled
      expect(screen.getByText(/Harus upload foto sebelum/i)).toBeInTheDocument()
      expect(screen.getByText(/Lengkapi data AC/i)).toBeInTheDocument()
    })
  })

  describe('4. Duration Calculation', () => {
    it('rounds duration to the nearest minute', () => {
      const baseTime = new Date('2026-06-11T10:00:00.000Z')
      
      // 89 seconds -> 1 minute (1.48 mins -> Math.round -> 1)
      const end89s = new Date(baseTime.getTime() + 89 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end89s.toISOString())).toBe(1)
      
      // 90 seconds -> 2 minutes (1.5 mins -> Math.round -> 2)
      const end90s = new Date(baseTime.getTime() + 90 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end90s.toISOString())).toBe(2)
      
      // 0 seconds -> 0 minutes
      expect(computeWorkDurationMinutes(baseTime.toISOString(), baseTime.toISOString())).toBe(0)
      
      // 3661 seconds (61 mins, 1s) -> 61 minutes
      const end3661s = new Date(baseTime.getTime() + 3661 * 1000)
      expect(computeWorkDurationMinutes(baseTime.toISOString(), end3661s.toISOString())).toBe(61)
    })
  })
})
