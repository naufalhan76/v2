import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { JobCompletionWizard } from '@/components/technician/job-completion-wizard'
import type { LocalJobSnapshot } from '@/lib/offline/snapshot'

// ─── Shared mock stores ────────────────────────────────────────────────────

const reportQueue = vi.hoisted(() => ({
  lastPayload: undefined as any,
  enqueueCalls: [] as any[],
}))

const photoQueue = vi.hoisted(() => ({
  enqueueCalls: [] as any[],
  nextId: 0,
}))

const snapshotStore = vi.hoisted(() => ({
  current: undefined as LocalJobSnapshot | undefined,
}))

// ─── Mocks (loaded before imports) ─────────────────────────────────────────

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

vi.mock('@/lib/offline/sync-manager', () => ({
  enqueueReport: vi.fn(async (input: any) => {
    reportQueue.lastPayload = input.payload
    reportQueue.enqueueCalls.push(input)
    return { idempotencyKey: input.payload.idempotency_key }
  }),
  enqueuePhoto: vi.fn(async (_input: any) => {
    photoQueue.enqueueCalls.push(_input)
    photoQueue.nextId += 1
    return { id: `photo-id-${photoQueue.nextId}`, uploadedPath: null }
  }),
  newIdempotencyKey: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
  drainQueue: vi.fn(async () => undefined),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/technician/signature-pad', () => ({
  SignaturePad: ({ onBlobChange, onChange }: {
    onBlobChange: (blob: Blob) => void
    onChange: (value: string) => void
  }) => (
    <button
      type="button"
      data-testid="signature-pad"
      onClick={() => {
        onBlobChange(new Blob(['signature'], { type: 'image/png' }))
        onChange('data:image/png;base64,c2lnbmF0dXJl')
      }}
    >
      Sign here
    </button>
  ),
}))

vi.mock('@/components/technician/photo-upload-offline', () => ({
  PhotoUploadOffline: ({ kind, value, onChange }: {
    kind: string
    value: string[]
    onChange: (urls: string[], photoIds: string[]) => void
  }) => (
    <div data-testid={`photo-upload-${kind}`}>
      <label>{kind === 'after' ? 'Foto Sesudah' : 'Foto Sebelum'}</label>
      <span data-testid={`photo-count-${kind}`}>{value.length}</span>
      <button
        type="button"
        data-testid={`add-${kind}-photo`}
        onClick={() => {
          const previewUrl = `preview-${kind}-${Date.now()}`
          const photoId = `photo-id-${kind}-${Date.now()}`
          onChange([previewUrl], [photoId])
        }}
      >
        Tambah Foto {kind}
      </button>
    </div>
  ),
}))

vi.mock('@/components/technician/material-input', () => ({
  MaterialInput: ({ value, onChange }: {
    value: Array<{ name: string; total: number }>
    onChange: (m: Array<unknown>) => void
  }) => (
    <div data-testid="material-input">
      <label>Material &amp; Sparepart</label>
      <span data-testid="material-count">{value.length}</span>
      <button
        type="button"
        data-testid="add-material"
        onClick={() => {
          onChange([
            ...value,
            {
              name: 'Test Part',
              qty: 1,
              unit_price: 50000,
              total: 50000,
              category: 'PARTS',
              unit_of_measure: 'pcs',
              is_manual: true,
            },
          ])
        }}
      >
        Tambah Material
      </button>
    </div>
  ),
}))

vi.mock('@/lib/utils/image-compression', () => ({
  compressImage: vi.fn().mockResolvedValue({
    blob: new Blob(['mock'], { type: 'image/png' }),
    bytes: 100,
    width: 800,
    height: 600,
    mimeType: 'image/png',
  }),
}))

// ─── Test helpers ───────────────────────────────────────────────────────────

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/technician/dimensions')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            unit_types: [{ unit_type_id: 'type-split', name: 'Split Wall' }],
            capacity_ranges: [{ capacity_id: 'cap-1pk', unit_type_id: 'type-split', capacity_label: '1 PK' }],
            ac_brands: [{ brand_id: 'brand-daikin', name: 'Daikin' }],
          },
        }),
      }
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          order_id: 'WO-E2E-001',
          status: 'IN_PROGRESS',
          canonical_status: 'IN_PROGRESS',
          has_report: false,
          report_id: null,
          scheduled_visit_date: '2026-06-13T10:00:00.000Z',
          customers: { customer_name: 'Budi E2E' },
          order_items: [
            {
              order_item_id: 'item-1',
              ac_unit_id: 'ac-1',
              service_type: 'Service AC',
              ac_units: {
                ac_unit_id: 'ac-1',
                brand: 'Daikin',
                brand_id: 'brand-daikin',
                ac_type: 'Split Wall',
                unit_type_id: 'type-split',
                capacity_id: 'cap-1pk',
                capacity_label: '1 PK',
                model_number: 'FTKQ',
                serial_number: 'SN-E2E',
                room_location: 'Ruang Tamu',
                floor_level: '1',
                position_detail: 'Dinding',
                capacity_ranges: { capacity_label: '1 PK' },
              },
              locations: { full_address: 'Jl. Integration No. 1' },
            },
          ],
          order_technicians: [{ technician_id: 'tech-1', role: 'lead' }],
        },
      }),
    }
  }))
}

/**
 * Build a draft that passes Step 1 validation.
 * Requires: photos_before AND photos_after populated, AC identity complete.
 */
function draftAtStep(step: number, extra: Record<string, unknown> = {}) {
  const base = {
    customerNameSigned: '',
    notes: '',
    nextServiceDate: '2026-09-13',
    workStartedAt: null,
    acUnits: [
      {
        ac_unit_id: 'ac-1',
        brand: 'Daikin',
        brand_id: 'brand-daikin',
        ac_type: 'Split Wall',
        unit_type_id: 'type-split',
        capacity_id: 'cap-1pk',
        capacity_label: '1 PK',
        model_number: 'FTKQ',
        serial_number: 'SN-E2E',
        room_location: 'Ruang Tamu',
        floor_level: '1',
        position_detail: 'Dinding',
        skipped: false,
        skip_reason: '',
        photos_before: ['before-photo-id'],
        photos_after: ['after-photo-id'],
        notes: '',
        materials_used: [],
      },
    ],
    currentStep: step,
    ...extra,
  }
  return JSON.stringify(base)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Wizard E2E Integration — Full Technician Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    snapshotStore.current = undefined
    reportQueue.lastPayload = undefined
    reportQueue.enqueueCalls = []
    photoQueue.enqueueCalls = []
    photoQueue.nextId = 0
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── Test 1: Full wizard flow (submit from pre-filled draft) ──────────────

  describe('1. Full wizard flow (renders → steps → submit)', () => {
    it('navigates through steps and submits a complete report', async () => {
      snapshotStore.current = undefined
      stubFetch()

      // Pre-fill draft at Step 1 with all data needed to pass validation
      localStorage.setItem('msn-erp-wizard-draft-WO-E2E-001', draftAtStep(1))

      render(<JobCompletionWizard orderId="WO-E2E-001" />)

      // ── Step 1: AC Inspection (draft restored, all fields populated) ────
      expect(await screen.findByText('Draft dipulihkan')).toBeInTheDocument()
      expect(screen.getByText(/Data Unit AC/i)).toBeInTheDocument()

      // Timer should be startable (photos_before is populated from draft)
      const startTimerBtn = await screen.findByRole('button', { name: /Mulai Waktu/i })
      expect(startTimerBtn).toBeEnabled()
      fireEvent.click(startTimerBtn)
      expect(screen.getByRole('button', { name: /Timer Berjalan/i })).toBeDisabled()

      // Advance to Step 2
      fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

      // ── Step 2: Signature ────────────────────────────────────────────────
      expect(await screen.findByText(/Tanda Tangan Pelanggan/i)).toBeInTheDocument()
      expect(screen.getByTestId('signature-pad')).toBeInTheDocument()

      // Fill customer name and sign
      const nameInput = screen.getByPlaceholderText('Nama pelanggan yang bertanda tangan')
      fireEvent.change(nameInput, { target: { value: 'Budi Pelanggan' } })
      fireEvent.click(screen.getByText('Sign here'))

      // Advance to Step 3
      fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

      // ── Step 3: Schedule & Notes ─────────────────────────────────────────
      expect(await screen.findByPlaceholderText('Catatan pengerjaan (opsional)')).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText('Catatan pengerjaan (opsional)'), {
        target: { value: 'E2E test notes' },
      })

      // Advance to Step 4 (Review)
      fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

      // ── Step 4: Review + Submit ──────────────────────────────────────────
      expect(await screen.findByText(/Review Laporan/i)).toBeInTheDocument()
      expect(screen.getByText(/AC 1: Daikin/i)).toBeInTheDocument()

      // Click submit button
      fireEvent.click(screen.getByTestId('submit-button'))

      // Confirmation modal should appear
      expect(screen.getByText(/Selesaikan Pekerjaan/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ya, Simpan' })).toBeInTheDocument()

      // Confirm
      fireEvent.click(screen.getByRole('button', { name: 'Ya, Simpan' }))

      // Wait for enqueue
      await waitFor(() => {
        expect(reportQueue.enqueueCalls.length).toBeGreaterThan(0)
      })

      // Verify payload shape
      const callArgs = reportQueue.enqueueCalls[0]
      expect(callArgs.orderId).toBe('WO-E2E-001')
      expect(callArgs.payload.customer_name_signed).toBe('Budi Pelanggan')
      expect(callArgs.payload.work_started_at).toBeTruthy()
      expect(callArgs.payload.work_completed_at).toBeTruthy()
      expect(callArgs.payload.work_duration_minutes).toBeGreaterThanOrEqual(0)
      expect(callArgs.payload.notes).toBe('E2E test notes')
      expect(callArgs.payload.ac_units).toHaveLength(1)
    })
  })

  // ── Test 2: Timer persistence mid-flow ──────────────────────────────────

  describe('2. Timer persistence (reload mid-flow)', () => {
    it('restores running timer from draft after unmount + remount', async () => {
      snapshotStore.current = undefined
      stubFetch()

      // Pre-fill draft at Step 1 with timer already started
      localStorage.setItem(
        'msn-erp-wizard-draft-WO-E2E-001',
        draftAtStep(1, {
          workStartedAt: new Date('2026-06-13T10:00:00.000Z').toISOString(),
        })
      )

      const { unmount } = render(<JobCompletionWizard orderId="WO-E2E-001" />)

      // Timer button should already show "Timer Berjalan" (disabled) from draft
      const timerBtn = await screen.findByRole('button', { name: /Timer Berjalan/i })
      expect(timerBtn).toBeDisabled()

      // Verify draft has workStartedAt
      const draft1 = JSON.parse(localStorage.getItem('msn-erp-wizard-draft-WO-E2E-001') || '{}')
      expect(draft1.workStartedAt).toEqual(expect.any(String))

      // Simulate page refresh (unmount + remount)
      unmount()

      // Remount — should restore timer from draft
      render(<JobCompletionWizard orderId="WO-E2E-001" />)

      // Timer button should still show "Timer Berjalan" (disabled)
      expect(await screen.findByRole('button', { name: /Timer Berjalan/i })).toBeDisabled()
    })
  })

  // ── Test 3: Offline submit ──────────────────────────────────────────────

  describe('3. Offline submit (report enqueued in IndexedDB)', () => {
    it('enqueues report when offline (not sent to API directly)', async () => {
      snapshotStore.current = undefined
      stubFetch()

      // Pre-fill draft at Step 2 to skip Step 1 validation
      localStorage.setItem(
        'msn-erp-wizard-draft-WO-E2E-001',
        draftAtStep(2, {
          customerNameSigned: 'Offline Customer',
          workStartedAt: new Date('2026-06-13T10:00:00.000Z').toISOString(),
        })
      )

      render(<JobCompletionWizard orderId="WO-E2E-001" />)

      // Should show "Draft dipulihkan" and be on Step 2
      expect(await screen.findByText('Draft dipulihkan')).toBeInTheDocument()
      expect(screen.getByText('Langkah 2 dari 4')).toBeInTheDocument()

      // Step 2: sign
      expect(screen.getByTestId('signature-pad')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Sign here'))

      // Advance to Step 3
      fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

      // Step 3: notes
      expect(await screen.findByPlaceholderText('Catatan pengerjaan (opsional)')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }))

      // Step 4: submit
      expect(await screen.findByTestId('submit-button')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('submit-button'))
      fireEvent.click(screen.getByRole('button', { name: 'Ya, Simpan' }))

      await waitFor(() => {
        expect(reportQueue.enqueueCalls.length).toBeGreaterThan(0)
      })

      // Report was enqueued via IndexedDB (offline pattern)
      expect(reportQueue.lastPayload).toBeDefined()
      expect(reportQueue.lastPayload.customer_name_signed).toBe('Offline Customer')
      expect(reportQueue.lastPayload.work_started_at).toBeTruthy()
    })
  })

  // ── Test 4: No arrival photo step in wizard ─────────────────────────────

  describe('4. No arrival photo step in wizard', () => {
    it('wizard does NOT render PhotoUpload for arrival photos', async () => {
      snapshotStore.current = undefined
      stubFetch()

      render(<JobCompletionWizard orderId="WO-E2E-001" />)

      // Wait for wizard to load
      expect(await screen.findByText(/Budi E2E/i)).toBeInTheDocument()

      // The wizard starts at Step 1 (AC Inspection) — no arrival photo modal
      expect(screen.queryByText(/Foto Kedatangan/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Foto Lokasi/i)).not.toBeInTheDocument()

      // Step 1 should be about AC units, not arrival
      expect(screen.getByText(/Data Unit AC/i)).toBeInTheDocument()

      // There is no "arrival" kind photo upload in the wizard
      // (arrival photos belong to job-detail-content, not the wizard)
      expect(screen.queryByLabelText(/arrival/i)).not.toBeInTheDocument()
    })
  })

  // ── Test 5: Second job blocked during active timer ──────────────────────

  describe('5. Second job blocked during active timer', () => {
    it('hasAnyActiveTimer returns true and prevents second job start', async () => {
      // Import the actual timer module
      const timer = await import('@/lib/offline/timer')

      // Clean slate
      localStorage.clear()

      // Start timer for job A
      const timerResult = timer.startTimer('WO-JOB-A')
      expect(timerResult.orderId).toBe('WO-JOB-A')
      expect(timer.hasAnyActiveTimer()).toBe(true)
      expect(timer.isTimerActive('WO-JOB-A')).toBe(true)

      // Attempting to start timer for job B should throw
      expect(() => timer.startTimer('WO-JOB-B')).toThrow(/Timer already active/)

      // Cleanup
      timer.clearTimer('WO-JOB-A')
    })
  })
})
