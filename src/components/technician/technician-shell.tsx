'use client'

import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function TechnicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isWizard = pathname?.includes('/job/') && pathname?.endsWith('/complete')
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isWizard) {
    return <>{children}</>
  }

  return (
    <div className="min-h-full pb-24 relative">
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-status-red-bg text-status-red-text px-4 py-2 flex items-center justify-center gap-2 pt-safe text-sm font-medium shadow-sm">
          <WifiOff className="w-4 h-4" />
          <span>Anda sedang offline</span>
        </div>
      )}
      {children}
    </div>
  )
}
