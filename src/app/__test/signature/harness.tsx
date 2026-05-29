'use client'

import { SignaturePad } from '@/components/technician/signature-pad'

declare global {
  interface Window {
    __signatureBlob: Blob | null | undefined
  }
}

export function SignatureHarness() {
  return (
    <SignaturePad
      onChange={() => {}}
      onBlobChange={(blob) => {
        window.__signatureBlob = blob
      }}
    />
  )
}
