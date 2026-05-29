import { notFound } from 'next/navigation'
import { AcFormHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function AcFormTestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="p-4 max-w-xl mx-auto min-h-screen">
      <h1 className="text-xl font-bold mb-4">AC Unit Form Test Harness</h1>
      <AcFormHarness />
    </div>
  )
}
