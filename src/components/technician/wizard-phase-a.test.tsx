import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { WizardPhaseA, type AcUnitData, type PhaseADraft } from './wizard-phase-a'

vi.mock('@/components/technician/photo-upload-offline', () => ({
  PhotoUploadOffline: ({ acUnitIdx, kind, onChange, value }: {
    acUnitIdx: number
    kind: string
    value: string[]
    onChange: (urls: string[], photoIds: string[]) => void
  }) => (
    <div data-testid={`photo-upload-${acUnitIdx}-${kind}`}>
      <p>Foto count: {value.length}</p>
      <button
        type="button"
        onClick={() => onChange([`before-preview-${acUnitIdx}`], [`before-photo-${acUnitIdx}`])}
      >
        Upload foto AC {acUnitIdx + 1}
      </button>
    </div>
  ),
}))

const dimensions = {
  unit_types: [
    { unit_type_id: 'type-split', name: 'Split Wall' },
    { unit_type_id: 'type-cassette', name: 'Cassette' },
  ],
  capacity_ranges: [
    { capacity_id: 'capacity-1pk', unit_type_id: 'type-split', capacity_label: '1 PK' },
    { capacity_id: 'capacity-2pk', unit_type_id: 'type-cassette', capacity_label: '2 PK' },
  ],
  ac_brands: [
    { brand_id: 'brand-daikin', name: 'Daikin' },
    { brand_id: 'brand-panasonic', name: 'Panasonic' },
  ],
}

function existingComplete(overrides: Partial<AcUnitData> = {}): AcUnitData {
  return {
    ac_unit_id: 'ac-existing-1',
    brand: 'Daikin',
    brand_id: 'brand-daikin',
    ac_type: 'Split Wall',
    unit_type_id: 'type-split',
    capacity_id: 'capacity-1pk',
    capacity_label: '1 PK',
    model_number: 'FTKQ25',
    serial_number: 'SN-001',
    room_location: 'Kamar Utama',
    floor_level: '1',
    position_detail: 'Dinding utara',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
    ...overrides,
  }
}

function newUnit(overrides: Partial<AcUnitData> = {}): AcUnitData {
  return {
    ac_unit_id: '',
    brand: '',
    brand_id: '',
    ac_type: '',
    unit_type_id: '',
    capacity_id: '',
    capacity_label: '',
    model_number: '',
    serial_number: '',
    room_location: '',
    floor_level: '',
    position_detail: '',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
    ...overrides,
  }
}

function renderPhaseA(acUnits: AcUnitData[], onComplete = vi.fn<(draft: PhaseADraft) => void>()) {
  render(<WizardPhaseA orderId="WO-PHASE-A-001" acUnits={acUnits} onComplete={onComplete} />)
  return onComplete
}

describe('WizardPhaseA', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: dimensions }),
    })))
  })

  it('renders AC units from the order with before photo upload areas', async () => {
    renderPhaseA([existingComplete(), newUnit()])

    expect(screen.getByText('Foto & Detail AC')).toBeInTheDocument()
    expect(screen.getByText('Langkah 1 dari 3')).toBeInTheDocument()
    expect(screen.getByText('AC 1')).toBeInTheDocument()
    expect(screen.getByText('AC 2')).toBeInTheDocument()
    expect(await screen.findByTestId('photo-upload-0-before')).toBeInTheDocument()
    expect(screen.getByTestId('photo-upload-1-before')).toBeInTheDocument()
  })

  it('shows full identity fields for new units', async () => {
    renderPhaseA([newUnit()])

    const card = screen.getByTestId('phase-a-unit-card-0')
    expect(await within(card).findByLabelText('Merk')).toBeInTheDocument()
    expect(within(card).getByLabelText('Jenis / Model')).toBeInTheDocument()
    expect(within(card).getByLabelText('Kapasitas')).toBeInTheDocument()
    expect(within(card).getByLabelText('Lokasi Ruangan')).toBeInTheDocument()
  })

  it('shows read-only identity and photo upload only for complete existing units', async () => {
    renderPhaseA([existingComplete()])

    const card = screen.getByTestId('phase-a-unit-card-0')
    expect(within(card).getByText('Daikin')).toBeInTheDocument()
    expect(within(card).getByText('Split Wall')).toBeInTheDocument()
    expect(within(card).getByText('1 PK')).toBeInTheDocument()
    expect(within(card).getByText('Kamar Utama')).toBeInTheDocument()
    expect(within(card).getByTestId('photo-upload-0-before')).toBeInTheDocument()
    expect(within(card).queryByLabelText('Merk')).not.toBeInTheDocument()
    expect(within(card).queryByLabelText('Jenis / Model')).not.toBeInTheDocument()
    expect(within(card).queryByLabelText('Kapasitas')).not.toBeInTheDocument()
    expect(within(card).queryByLabelText('Lokasi Ruangan')).not.toBeInTheDocument()
  })

  it('shows editable controls only for missing identity fields on incomplete existing units', async () => {
    renderPhaseA([existingComplete({ capacity_id: '', capacity_label: '', room_location: '' })])

    const card = screen.getByTestId('phase-a-unit-card-0')
    expect(await within(card).findByText('Data AC eksisting belum lengkap')).toBeInTheDocument()
    expect(within(card).getByText('Daikin')).toBeInTheDocument()
    expect(within(card).getByText('Split Wall')).toBeInTheDocument()
    expect(within(card).getByLabelText('Kapasitas')).toBeInTheDocument()
    expect(within(card).getByLabelText('Lokasi Ruangan')).toBeInTheDocument()
    expect(within(card).queryByLabelText('Merk')).not.toBeInTheDocument()
    expect(within(card).queryByLabelText('Jenis / Model')).not.toBeInTheDocument()
  })

  it('requires at least one before photo for each non-skipped unit', async () => {
    renderPhaseA([
      existingComplete(),
      newUnit({
        brand: 'Panasonic',
        brand_id: 'brand-panasonic',
        ac_type: 'Split Wall',
        unit_type_id: 'type-split',
        capacity_id: 'capacity-1pk',
        capacity_label: '1 PK',
        room_location: 'Ruang Tamu',
      }),
      existingComplete({ ac_unit_id: 'ac-skipped', skipped: true }),
    ])

    fireEvent.click(screen.getByRole('button', { name: /Lanjut ke Timer/i }))

    expect(await screen.findByText('AC 1: minimal 1 foto sebelum wajib diunggah')).toBeInTheDocument()
    expect(screen.getByText('AC 2: minimal 1 foto sebelum wajib diunggah')).toBeInTheDocument()
    expect(screen.queryByText('AC 3: minimal 1 foto sebelum wajib diunggah')).not.toBeInTheDocument()
  })

  it('saves a Phase A draft to localStorage and calls onComplete after valid submit', async () => {
    const onComplete = renderPhaseA([existingComplete(), newUnit()])
    const newUnitCard = screen.getByTestId('phase-a-unit-card-1')

    await userEvent.selectOptions(await within(newUnitCard).findByLabelText('Merk'), 'brand-panasonic')
    await userEvent.selectOptions(within(newUnitCard).getByLabelText('Jenis / Model'), 'type-split')
    await userEvent.selectOptions(within(newUnitCard).getByLabelText('Kapasitas'), 'capacity-1pk')
    await userEvent.type(within(newUnitCard).getByLabelText('Lokasi Ruangan'), 'Ruang Tamu')
    fireEvent.click(screen.getByRole('button', { name: 'Upload foto AC 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Upload foto AC 2' }))
    fireEvent.click(screen.getByRole('button', { name: /Lanjut ke Timer/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const draft = JSON.parse(localStorage.getItem('msn-tech-wizard-draft-WO-PHASE-A-001') || '{}')

    expect(draft).toEqual({
      units: [
        {
          unitIndex: 0,
          photos: ['before-preview-0'],
          identity: {
            ac_unit_id: 'ac-existing-1',
            brand: 'Daikin',
            brand_id: 'brand-daikin',
            ac_type: 'Split Wall',
            unit_type_id: 'type-split',
            capacity_id: 'capacity-1pk',
            capacity_label: '1 PK',
            model_number: 'FTKQ25',
            room_location: 'Kamar Utama',
          },
        },
        {
          unitIndex: 1,
          photos: ['before-preview-1'],
          identity: {
            ac_unit_id: '',
            brand: 'Panasonic',
            brand_id: 'brand-panasonic',
            ac_type: 'Split Wall',
            unit_type_id: 'type-split',
            capacity_id: 'capacity-1pk',
            capacity_label: '1 PK',
            model_number: '',
            room_location: 'Ruang Tamu',
          },
        },
      ],
    })
    expect(onComplete).toHaveBeenCalledWith(draft)
  })
})
