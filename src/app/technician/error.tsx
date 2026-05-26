'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function TechnicianError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Technician app error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-6">
        Maaf, terjadi kesalahan. Silakan coba lagi.
      </p>
      <Button onClick={reset} variant="outline" className="h-11 min-w-[120px]">
        <RotateCcw className="mr-2 h-4 w-4" />
        Coba Lagi
      </Button>
    </div>
  )
}
