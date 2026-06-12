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
      <div className="bg-white dark:bg-[#1a1833] rounded-[40px] p-6 flex flex-col items-center text-center shadow-2xl w-full max-w-sm">
        <div className="bg-gray-100 dark:bg-[#252243] p-6 rounded-full mb-6">
          <Icon className="w-10 h-10 text-gray-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold mb-4 text-[#1e1b4b] dark:text-white">{title}</h2>
        <p className="text-gray-400 text-sm mb-8 px-2 leading-loose">
          {message}
        </p>
        <button
          onClick={onAction}
          className="flex w-full items-center justify-center border-2 border-gray-200 dark:border-white/10 rounded-2xl py-3 text-[#211c59] dark:text-white font-semibold px-8 hover:bg-gray-50 dark:hover:bg-[#252243] transition-colors"
        >
          {buttonIcon}
          {buttonText}
        </button>
      </div>
    </div>
  )
}
