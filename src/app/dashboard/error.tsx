'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Dashboard error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Halaman Gagal Dimuat</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Terjadi kesalahan saat memuat halaman dashboard. Data Anda aman — silakan coba muat ulang.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Muat Ulang
        </Button>
        <Button onClick={() => window.location.href = '/dashboard'} variant="default">
          Ke Dashboard
        </Button>
      </div>
    </div>
  )
}
