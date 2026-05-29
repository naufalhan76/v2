'use client'

import { useState } from 'react'
import { AcUnitForm, type AcUnitFormValue } from '@/components/technician/ac-unit-form'

// Test harness — dev only

// Attach to window for playwright to assert
declare global {
  interface Window {
    __acFormValue: AcUnitFormValue[]
  }
}

export default function AcFormTestHarness() {
  const [initialUnits] = useState<AcUnitFormValue[]>([
    {
      ac_unit_id: 'AC0001',
      brand: 'Daikin',
      capacity_pk: '1 PK',
      room_location: 'Kamar Utama',
      model_number: '',
      serial_number: '',
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
      capacity_pk: '1/2 PK',
      room_location: 'Ruang Tamu',
      model_number: '',
      serial_number: '',
      ac_type: 'Split',
      skipped: false,
      skip_reason: '',
      photos_before: [],
      photos_after: [],
      notes: '',
      materials_used: [],
    },
  ])

  const handleChange = (units: AcUnitFormValue[]) => {
    if (typeof window !== 'undefined') {
      window.__acFormValue = units
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto dark:bg-zinc-950 dark:text-zinc-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4">AC Unit Form Test Harness</h1>
      <AcUnitForm
        orderId="TEST-ORDER-123"
        initialUnits={initialUnits}
        onChange={handleChange}
      />
    </div>
  )
}
