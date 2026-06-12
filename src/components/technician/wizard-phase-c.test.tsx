import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

const syncStore = vi.hoisted(() => ({
  reportInput: undefined as unknown,
  enqueueReport: vi.fn(async (input: { payload: { idempotency_key: string } }) => {
    syncStore.reportInput = input
    return { idempotencyKey: input.payload.idempotency_key }
  }),
  enqueuePhoto: vi.fn(async () => ({ id: 'photo-1', uploadedPath: null })),
  newIdempotencyKey: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}))

vi.mock('@/lib/offline/sync-manager', () => ({
  enqueueReport: syncStore.enqueueReport,
  enqueuePhoto: syncStore.enqueuePhoto,
  newIdempotencyKey: syncStore.newIdempotencyKey,
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
      Sign here
    </button>
  ),
}))

vi.mock('@/components/technician/photo-upload-offline', () => ({
  PhotoUploadOffline: ({ kind, value, onChange }: { kind: string; value: string[]; onChange: (urls: string[], ids: string[]) => void }) => (
    <div data-testid={`photo-upload-${kind}`}>
      <label>{kind === 'after' ? 'Foto Sesudah' : 'Foto Sebelum'}</label>
      <span>({value.length})</span>
      <button
        type="button"
        data-testid={`add-${kind}-photo`}
        onClick={() => {
          const next = [...value, `preview-${kind}-${Date.now()}`]
          onChange(next, ['photo-id-after'])
        }}
      >
        Tambah Foto {kind}
      </button>
    </div>
  ),
}))

vi.mock('@/components/technician/material-input', () => ({
  MaterialInput: ({ value, onChange }: { value: Array<{ name: string; total: number }>; onChange: (m: Array<unknown>) => void }) => (
    <div data-testid="material-input">
      <label>Material &amp; Sparepart</label>
      <span>{value.length} item(s)</span>
      <button
        type="button"
        data-testid="add-material"
        onClick={() => {
          onChange([...value, { name: 'Test Part', qty: 1, unit_price: 50000, total: 50000, category: 'PARTS', unit_of_measure: 'pcs', is_manual: true }])
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WizardPhaseC } from './wizard-phase-c'
import type { PhaseADraft } from './wizard-phase-a'
import * as timer from '../../lib/offline/timer'

const mockDraft: PhaseADraft = {
  units: [
    { unitIndex: 0, photos: ['data:image/png;base64,mock-before'], identity: {
      ac_unit_id: 'ac-001', brand: 'Daikin', brand_id: 'brand-1',
      ac_type: 'Split', unit_type_id: 'ut-1', capacity_id: 'cap-1',
      capacity_label: '1 PK', model_number: 'FTK-01', room_location: 'Ruang Tamu',
    }},
  ],
}

function renderPhaseC(onComplete = vi.fn(), phaseADraft = mockDraft) {
  render(
    <WizardPhaseC orderId="WO-PHASE-C-001" phaseADraft={phaseADraft} onComplete={onComplete} />
  )
  return onComplete
}

describe('WizardPhaseC', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-12T10:00:00.000Z'))
    timer.startTimer('WO-PHASE-C-001')
    syncStore.reportInput = undefined
    syncStore.enqueueReport.mockClear()
    syncStore.enqueuePhoto.mockClear()
    syncStore.newIdempotencyKey.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders header with "Detail Pekerjaan" and "Langkah 3 dari 3"', () => {
    renderPhaseC()
    expect(screen.getByText('Detail Pekerjaan')).toBeInTheDocument()
    expect(screen.getByText('Langkah 3 dari 3')).toBeInTheDocument()
  })

  it('renders addons/materials form per AC unit', () => {
    renderPhaseC()
    expect(screen.getByText(/Material & Sparepart/i)).toBeInTheDocument()
  })

  it('renders after photo upload area per unit', () => {
    renderPhaseC()
    expect(screen.getByText('Foto Sesudah')).toBeInTheDocument()
  })

  it('renders signature pad section', () => {
    renderPhaseC()
    expect(screen.getByText('Sign here')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nama pelanggan yang bertanda tangan')).toBeInTheDocument()
  })

  it('renders next service date field', () => {
    renderPhaseC()
    expect(screen.getByLabelText('Tanggal servis berikutnya')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Catatan servis berikutnya (opsional)')).toBeInTheDocument()
  })

  it('renders additional notes textarea', () => {
    renderPhaseC()
    expect(screen.getByPlaceholderText('Catatan pengerjaan (opsional)')).toBeInTheDocument()
  })

  it('renders submit button with correct text', () => {
    renderPhaseC()
    const btn = screen.getByRole('button', { name: /Submit Laporan Akhir/i })
    expect(btn).toBeInTheDocument()
  })

  it('shows confirmation modal when submit button is clicked', () => {
    renderPhaseC()
    fireEvent.click(screen.getByRole('button', { name: /Submit Laporan Akhir/i }))
    expect(screen.getByText('Konfirmasi Submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya, Simpan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kembali' })).toBeInTheDocument()
  })

  it('calls stopTimer and enqueues report with correct payload shape', async () => {
    // Switch to real timers for the async submit flow
    vi.useRealTimers()

    const onComplete = renderPhaseC()

    fireEvent.change(screen.getByPlaceholderText('Nama pelanggan yang bertanda tangan'), {
      target: { value: 'Budi Pelanggan' },
    })
    fireEvent.click(screen.getByText('Sign here'))
    fireEvent.change(screen.getByPlaceholderText('Catatan pengerjaan (opsional)'), {
      target: { value: 'Test notes' },
    })
    fireEvent.change(screen.getByLabelText('Tanggal servis berikutnya'), {
      target: { value: '2026-09-12' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Laporan Akhir/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Simpan' }))

    await waitFor(() => {
      expect(syncStore.enqueueReport).toHaveBeenCalled()
    })

    const callArgs = (syncStore.enqueueReport as any).mock.calls[0][0]
    expect(callArgs.orderId).toBe('WO-PHASE-C-001')
    expect(callArgs.payload.customer_name_signed).toBe('Budi Pelanggan')
    expect(callArgs.payload.work_started_at).toBeTruthy()
    expect(callArgs.payload.work_completed_at).toBeTruthy()
    expect(timer.getActiveTimer()).toBeNull()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('enqueues signature photo during submit', async () => {
    vi.useRealTimers()

    renderPhaseC()

    fireEvent.change(screen.getByPlaceholderText('Nama pelanggan yang bertanda tangan'), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByText('Sign here'))

    fireEvent.click(screen.getByRole('button', { name: /Submit Laporan Akhir/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Simpan' }))

    await waitFor(() => {
      expect(syncStore.enqueuePhoto).toHaveBeenCalled()
    })

    const photoCall = (syncStore.enqueuePhoto as any).mock.calls[0][0]
    expect(photoCall.orderId).toBe('WO-PHASE-C-001')
    expect(photoCall.kind).toBe('signature')
    expect(photoCall.acUnitIdx).toBe(-1)
  })

  it('clears Phase A draft from localStorage on successful submit', async () => {
    vi.useRealTimers()

    const draftKey = 'msn-tech-wizard-draft-WO-PHASE-C-001'
    localStorage.setItem(draftKey, JSON.stringify(mockDraft))

    renderPhaseC()

    fireEvent.change(screen.getByPlaceholderText('Nama pelanggan yang bertanda tangan'), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByText('Sign here'))

    fireEvent.click(screen.getByRole('button', { name: /Submit Laporan Akhir/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Simpan' }))

    await waitFor(() => {
      expect(syncStore.enqueueReport).toHaveBeenCalled()
    })

    expect(localStorage.getItem(draftKey)).toBeNull()
  })

  it('does not submit when cancel is clicked in confirmation modal', () => {
    renderPhaseC()
    fireEvent.click(screen.getByRole('button', { name: /Submit Laporan Akhir/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Kembali' }))
    expect(syncStore.enqueueReport).not.toHaveBeenCalled()
    expect(screen.queryByText('Konfirmasi Submit')).not.toBeInTheDocument()
  })
})
