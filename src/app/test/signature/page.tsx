'use client'

import { SignaturePad } from '@/components/technician/signature-pad'

declare global {
  interface Window {
    __signatureBlob: Blob | null | undefined
  }
}

export default function SignatureHarness() {
  return (
    <main style={{ padding: '16px' }}>
      <p>signature test harness</p>
      <SignaturePad
        onChange={() => {}}
        onBlobChange={(blob) => {
          window.__signatureBlob = blob
        }}
      />
    </main>
  )
}
