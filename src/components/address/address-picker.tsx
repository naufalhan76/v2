import dynamic from 'next/dynamic'
import type { AddressPickerValue } from './address-picker-inner'

type AddressPickerProps = {
  value: AddressPickerValue
  onChange: (value: { lat: number; lng: number }) => void
  suggestionsQuery?: string
}

function AddressPickerSkeleton() {
  return (
    <div className="space-y-3" aria-label="Memuat pemilih alamat">
      <div className="h-9 rounded-sm border border-border bg-surface-muted" />
      <div className="h-72 rounded-sm border border-border bg-surface-muted" />
      <div className="h-4 w-40 rounded-sm bg-surface-muted" />
    </div>
  )
}

export const AddressPicker = dynamic<AddressPickerProps>(() => import('./address-picker-inner').then((mod) => mod.AddressPickerInner), {
  ssr: false,
  loading: AddressPickerSkeleton,
})
