'use client'

import { useEffect } from 'react'
import { AlertCircle, WifiOff, Lock, RefreshCw, LogIn } from 'lucide-react'
import { logger } from '@/lib/logger'
import { useRouter } from 'next/navigation'

export default function TechnicianError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    logger.error('Technician app error boundary caught:', error)
  }, [error])

  const errorMessage = error.message?.toLowerCase() || ''
  const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('failed to fetch')
  const isAuthError = errorMessage.includes('auth') || errorMessage.includes('session') || errorMessage.includes('unauthorized') || errorMessage.includes('jwt')

  let Icon = AlertCircle
  let title = 'Terjadi Kesalahan'
  let message = 'Maaf, terjadi kesalahan. Silakan coba lagi.'
  let buttonIcon = <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
  let buttonText = 'Coba Lagi'
  let onAction = reset

  if (isNetworkError) {
    Icon = WifiOff
    title = 'Tidak dapat terhubung'
    message = 'Periksa koneksi internet Anda dan coba lagi.'
  } else if (isAuthError) {
    Icon = Lock
    title = 'Sesi berakhir'
    message = 'Sesi Anda telah berakhir. Silakan masuk kembali.'
    buttonIcon = <LogIn className="mr-2 h-5 w-5" aria-hidden="true" />
    buttonText = 'Masuk'
    onAction = () => {
      // Clear caches and redirect to login
      router.push('/login')
    }
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="bg-white dark:bg-surface-muted rounded-[40px] p-6 flex flex-col items-center text-center shadow-2xl w-full max-w-sm">
        <div className="bg-muted dark:bg-surface p-6 rounded-full mb-6">
          <Icon className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold mb-4 text-primary dark:text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm mb-8 px-2 leading-loose">
          {message}
        </p>
        <button
          onClick={onAction}
          className="flex w-full items-center justify-center border-2 border-border dark:border-border rounded-2xl py-3 text-primary dark:text-foreground font-semibold px-8 hover:bg-muted dark:hover:bg-surface transition-colors"
        >
          {buttonIcon}
          {buttonText}
        </button>
      </div>
    </div>
  )
}
