import { notFound } from 'next/navigation'
import { SignatureHarness } from './harness'

export default function SignatureTestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <main style={{ padding: '16px' }}>
      <p>signature test harness</p>
      <SignatureHarness />
    </main>
  )
}
