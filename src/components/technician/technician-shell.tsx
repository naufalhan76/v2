'use client'

import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'

export function TechnicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isWizard = pathname?.includes('/job/') && pathname?.endsWith('/complete')

  if (isWizard) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">{children}</div>
  )
}
