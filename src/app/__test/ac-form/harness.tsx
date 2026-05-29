'use client'

import { AcUnitForm, type AcUnitFormValue } from '@/components/technician/ac-unit-form'

// __acFormValue is declared globally in %5F%5Ftest/ac-form/page.tsx; no re-declaration needed.

const INITIAL_UNITS: AcUnitFormValue[] = [
  {
    ac_unit_id: 'AC0001',
    brand: 'Daikin',
    capacity_pk: '1',
    room_location: 'Ruang Tamu',
    model_number: 'FT25NV14',
    serial_number: 'SN001',
    ac_type: 'Split',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
  },
  {
    ac_unit_id: 'AC0002',
    brand: 'Panasonic',
    capacity_pk: '1',
    room_location: 'Kamar Tidur',
    model_number: 'CS-PN9UKJ',
    serial_number: 'SN002',
    ac_type: 'Split',
    skipped: false,
    skip_reason: '',
    photos_before: [],
    photos_after: [],
    notes: '',
    materials_used: [],
  },
]

export function AcFormHarness() {
  return (
    <AcUnitForm
      orderId="ORDER-TEST-001"
      initialUnits={INITIAL_UNITS}
      onChange={(units) => {
        window.__acFormValue = units
      }}
    />
  )
}
