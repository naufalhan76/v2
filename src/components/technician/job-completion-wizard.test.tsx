import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { JobCompletionWizard } from './job-completion-wizard'
import type { LocalJobSnapshot } from '../../lib/offline/snapshot'
import type { AcUnitReportItem } from '../../app/api/schemas/technician'

const snapshotStore = vi.hoisted(() => ({
  current: undefined as LocalJobSnapshot | undefined,
}))

const routerStore = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}))

const toastStore = vi.hoisted(() => ({
  toast: vi.fn(),
}))

const syncStore = vi.hoisted(() => ({
  reportInput: undefined as unknown,
  enqueueReport: vi.fn(async (input: { payload: { idempotency_key: string } }) => {
    syncStore.reportInput = input
    return { idempotencyKey: input.payload.idempotency_key }
  }),
  enqueuePhoto: vi.fn(async () => ({ id: 'signature-photo-id' })),
  newIdempotencyKey: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerStore,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastStore.toast }),
}))

vi.mock('@/lib/offline/snapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/offline/snapshot')>()
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

vi.mock('@/lib/offline/sync-manager', () => ({
  enqueueReport: syncStore.enqueueReport,
  enqueuePhoto: syncStore.enqueuePhoto,
  newIdempotencyKey: syncStore.newIdempotencyKey,
}))

vi.mock('@/components/technician/sync-status', () => ({
  SyncStatus: () => <div data-testid="sync-status-badge" />,
}))

vi.mock('@/components/technician/signature-pad', () => ({
  SignaturePad: ({ onBlobChange, onChange }: { onBlobChange: (blob: Blob) => void; onChange: (value: string) => void }) => (
    <button
      type="button"
      data-testid="signature-pad"
      onClick={() => {
        onBlobChange(new Blob(['signature'], { type: 'image/png' }))
        onChange('data:image/png;base64,c2lnbmF0dXJl')
      }}
    >
      Sign customer
    </button>
  ),
}))

vi.mock('@/components/technician/ac-unit-form', () => ({
  AcUnitForm: ({ formUnits, onChange, onPhotoIdsChange }: {
    formUnits: AcUnitReportItem[]
    onChange: (units: AcUnitReportItem[]) => void
    onPhotoIdsChange?: (ids: string[]) => void
  }) => (
    <div data-testid="mock-ac-unit-form">
      <p>Mock AC count: {formUnits.length}</p>
      <button
        type="button"
        onClick={() => {
          onChange([
            {
              ...formUnits[0],
              photos_before: ['before-preview-url'],
              photos_after: ['after-preview-url'],
              materials_used: [
                {
                  addon_id: null,
                  name: 'Kapasitor',
                  qty: 2,
                  unit_price: 50000,
                  total: 100000,
                  category: 'PARTS',
                  unit_of_measure: 'pcs',
                  is_manual: true,
                },
              ],
            },
          ])
          onPhotoIdsChange?.(['before-photo-id', 'after-photo-id'])
        }}
      >
        Mark AC complete
      </button>
    </div>
  ),
}))

function validAcUnit(overrides: Partial<AcUnitReportItem> = {}): AcUnitReportItem {
  return {
    ac_unit_id: 'ac-1',
    brand: 'Daikin',
    brand_id: '11111111-1111-4111-8111-111111111111',
    ac_type: 'Split',
    unit_type_id: '22222222-2222-4222-8222-222222222222',
    capacity_id: '33333333-3333-4333-8333-333333333333',
    capacity_label: '1 PK',
    model_number: 'FTKQ',
    serial_number: 'SN-1',
    room_location: 'Kamar',
    floor_level: '1',
    position_detail: 'Dinding',
    skipped: false,
    skip_reason: '',
    photos_before: ['before-preview-url'],
    photos_after: ['after-preview-url'],
    notes: 'Unit dingin normal',
    materials_used: [],
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<LocalJobSnapshot> = {}): LocalJobSnapshot {
  return {
    orderId: 'WO-CHAR-001',
    status: 'IN_PROGRESS',
    customer: {
      name: 'Budi Character',
      address: 'Jl. Test No. 1',
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
          acType: 'Split',
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
    syncedAt: Date.now() - 60_000,
    locked: true,
    ...overrides,
  }
}

function stubBackgroundFetch() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
}

function writeDraft(orderId: string, draft: Record<string, unknown>) {
  localStorage.setItem(`msn-erp-wizard-draft-${orderId}`, JSON.stringify(draft))
}

describe('JobCompletionWizard current behavior', () => {
  beforeEach(() => {
    localStorage.clear()
    snapshotStore.current = makeSnapshot()
    syncStore.reportInput = undefined
    syncStore.enqueueReport.mockClear()
    syncStore.enqueuePhoto.mockClear()
    syncStore.newIdempotencyKey.mockClear()
    routerStore.push.mockClear()
    toastStore.toast.mockClear()
    vi.unstubAllGlobals()
    stubBackgroundFetch()
  })

  it('blocks forward navigation on step 1 until required AC photos exist, then allows back navigation from step 2', async () => {
    render(<JobCompletionWizard orderId="WO-CHAR-001" />)

    expect(await screen.findByText('Langkah 1 dari 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

    expect(await screen.findByText('AC 1: minimal 1 foto sebelum wajib diunggah')).toBeInTheDocument()
    expect(screen.getByText('AC 1: minimal 1 foto sesudah wajib diunggah')).toBeInTheDocument()
    expect(screen.getByText('Langkah 1 dari 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Mark AC complete/i }))
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

    expect(await screen.findByText('Langkah 2 dari 4')).toBeInTheDocument()
    expect(screen.getByText('Tanda Tangan Pelanggan')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sebelumnya/i }))
    expect(await screen.findByText('Langkah 1 dari 4')).toBeInTheDocument()
  })

  it('blocks step 2 navigation until signature blob exists', async () => {
    writeDraft('WO-CHAR-001', {
      customerNameSigned: 'Budi Character',
      notes: '',
      nextServiceDate: '2026-09-11',
      nextServiceNotes: '',
      acUnits: [validAcUnit()],
      currentStep: 2,
    })

    render(<JobCompletionWizard orderId="WO-CHAR-001" />)

    expect(await screen.findByText('Tanda Tangan Pelanggan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

    expect(await screen.findByText('Tanda tangan pelanggan wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Langkah 2 dari 4')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('signature-pad'))
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

    expect(await screen.findByRole('heading', { name: 'Jadwal & Catatan' })).toBeInTheDocument()
    expect(screen.getByText('Langkah 3 dari 4')).toBeInTheDocument()
  })

  it('restores local draft state and persists edits back to localStorage', async () => {
    writeDraft('WO-CHAR-001', {
      customerNameSigned: 'Nama Draft',
      notes: 'Catatan draft lama',
      nextServiceDate: '2026-09-11',
      nextServiceNotes: 'Cuci besar',
      acUnits: [validAcUnit({ brand: 'Draft Brand' })],
      currentStep: 3,
    })

    render(<JobCompletionWizard orderId="WO-CHAR-001" />)

    expect(await screen.findByText('Draft dipulihkan')).toBeInTheDocument()
    expect(screen.getByText('Langkah 3 dari 4')).toBeInTheDocument()
    expect(screen.getByLabelText('Catatan Tambahan')).toHaveValue('Catatan draft lama')

    await userEvent.clear(screen.getByLabelText('Catatan Tambahan'))
    await userEvent.type(screen.getByLabelText('Catatan Tambahan'), 'Catatan draft baru')

    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('msn-erp-wizard-draft-WO-CHAR-001') || '{}')
      expect(draft.notes).toBe('Catatan draft baru')
      expect(draft.currentStep).toBe(3)
      expect(draft.acUnits[0].brand).toBe('Draft Brand')
    })
  })

  it('submits the current TechnicianReportPayload shape through enqueueReport and clears draft', async () => {
    const startedAt = new Date(Date.now() - 90_000).toISOString()
    writeDraft('WO-CHAR-001', {
      customerNameSigned: 'Nama Draft',
      notes: 'Catatan final',
      nextServiceDate: '2026-09-11',
      nextServiceNotes: 'Servis 3 bulan',
      workStartedAt: startedAt,
      acUnits: [
        validAcUnit({
          materials_used: [
            {
              addon_id: null,
              name: 'Kapasitor',
              qty: 2,
              unit_price: 50000,
              total: 100000,
              category: 'PARTS',
              unit_of_measure: 'pcs',
              is_manual: true,
            },
          ],
        }),
      ],
      currentStep: 2,
    })

    render(<JobCompletionWizard orderId="WO-CHAR-001" />)

    expect(await screen.findByText('Tanda Tangan Pelanggan')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('signature-pad'))
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Selanjutnya/i }))
    fireEvent.click(await screen.findByTestId('submit-button'))
    fireEvent.click(await screen.findByRole('button', { name: /Ya, Simpan/i }))

    await waitFor(() => expect(syncStore.enqueueReport).toHaveBeenCalledTimes(1))
    expect(syncStore.enqueuePhoto).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'WO-CHAR-001',
      acUnitIdx: -1,
      kind: 'signature',
      mimeType: 'image/png',
    }))
    expect(syncStore.reportInput).toMatchObject({
      orderId: 'WO-CHAR-001',
      technicianId: 'tech-1',
      photoIds: ['signature-photo-id'],
      payload: {
        idempotency_key: '11111111-1111-4111-8111-111111111111',
        photos_before: [],
        photos_after: [],
        materials: [expect.objectContaining({ name: 'Kapasitor', total: 100000 })],
        actual_total_price: 100000,
        customer_signature_url: '',
        customer_name_signed: 'Nama Draft',
        notes: 'Catatan final',
        work_started_at: startedAt,
        work_duration_minutes: 2,
        next_service_recommendation_date: '2026-09-11',
        next_service_recommendation_notes: 'Servis 3 bulan',
        ac_units: [expect.objectContaining({ photos_before: [], photos_after: [] })],
      },
    })
    expect(syncStore.reportInput).toMatchObject({ payload: { work_completed_at: expect.any(String) } })
    expect(localStorage.getItem('msn-erp-wizard-draft-WO-CHAR-001')).toBeNull()
    expect(routerStore.push).toHaveBeenCalledWith('/technician')
  })
})
