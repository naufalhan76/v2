'use client'

import dynamic from 'next/dynamic'

type AddressPickerReadOnlyProps = {
  lat: number | null
  lng: number | null
}

function AddressPickerReadOnlySkeleton() {
  return (
    <div className="space-y-2 mt-2" aria-label="Memuat peta lokasi">
      <div className="h-44 rounded-sm border border-border bg-surface-muted" />
      <div className="h-4 w-40 rounded-sm bg-surface-muted" />
    </div>
  )
}

export const AddressPickerReadOnly = dynamic<AddressPickerReadOnlyProps>(
  () => import('./address-picker-readonly-inner').then((mod) => mod.AddressPickerReadOnlyInner),
  {
    ssr: false,
    loading: AddressPickerReadOnlySkeleton,
  }
)
