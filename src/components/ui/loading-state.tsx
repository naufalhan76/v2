'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'

interface LoadingStateProps {
  isLoading: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
  timeout?: number // Timeout dalam ms, default 10000 (10 detik)
  showTimeout?: boolean // Tampilkan pesan timeout, default true
  className?: string
  size?: 'sm' | 'md' | 'lg' // Ukuran loading spinner
  message?: string // Pesan kustom
  showRetry?: boolean // Tampilkan tombol retry saat timeout
  onRetry?: () => void // Fungsi retry
}

// Komponen Loading State dengan timeout dan fallback
export function LoadingState({
  isLoading,
  children,
  fallback,
  timeout = 10000,
  showTimeout = true,
  className = '',
  size = 'md',
  message = 'Loading...',
  showRetry = true,
  onRetry
}: LoadingStateProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false)
      setShowFallback(false)
      return
    }

    // Set timeout untuk menampilkan pesan timeout
    const timeoutTimer = setTimeout(() => {
      setHasTimedOut(true)
    }, timeout)

    // Set timeout untuk menampilkan fallback (jika ada)
    const fallbackTimer = setTimeout(() => {
      if (fallback) {
        setShowFallback(true)
      }
    }, timeout + 2000) // 2 detik setelah timeout

    return () => {
      clearTimeout(timeoutTimer)
      clearTimeout(fallbackTimer)
    }
  }, [isLoading, timeout, fallback])

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  if (!isLoading) {
    return <>{children}</>
  }

  return (
    <div className={`flex flex-col items-center justify-center p-6 sm:p-8 w-full min-h-[120px] ${className}`}>
      {!hasTimedOut ? (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
          <p className="text-sm text-ink-mute animate-pulse text-center">
            {message}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 max-w-md w-full text-center px-2">
          {showTimeout && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Loading is taking longer than expected. This might be due to a slow connection or server issue.
              </AlertDescription>
            </Alert>
          )}
          
          {showFallback && fallback ? (
            <div className="w-full">
              {fallback}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-mute">
                Still loading... Please wait.
              </p>
              {showRetry && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Komponen Loading Overlay untuk menutupi konten saat loading
interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  message?: string
  timeout?: number
  className?: string
  fullscreen?: boolean
  autoFocus?: boolean
}

export function LoadingOverlay({
  isLoading,
  children,
  message = 'Loading...',
  timeout = 10000,
  className = '',
  fullscreen = false,
  autoFocus = false
}: LoadingOverlayProps) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading) {
      setShowOverlay(false)
      setHasTimedOut(false)
      return
    }

    // Tampilkan overlay setelah 300ms untuk mencegah flicker
    const overlayTimer = setTimeout(() => {
      setShowOverlay(true)
    }, 300)

    // Timeout untuk pesan timeout
    const timeoutTimer = setTimeout(() => {
      setHasTimedOut(true)
    }, timeout)

    return () => {
      clearTimeout(overlayTimer)
      clearTimeout(timeoutTimer)
    }
  }, [isLoading, timeout])

  useEffect(() => {
    if (showOverlay && autoFocus) {
      overlayRef.current?.focus()
    }
  }, [showOverlay, autoFocus])

  const overlayClassName = fullscreen
    ? 'fixed inset-0 bg-foreground/40 flex items-center justify-center z-[100]'
    : 'absolute inset-0 bg-foreground/40 flex items-center justify-center z-50'

  return (
    <div className={`relative ${className}`}>
      {children}
      {showOverlay && (
        <div
          ref={overlayRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={overlayClassName}
        >
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-ink-mute">
              {hasTimedOut ? 'Taking longer than expected...' : message}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Komponen Loading Dots untuk indikator loading yang lebih ringan
export function LoadingDots({ 
  size = 'md', 
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg'
  className?: string 
}) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  return (
    <div className={`flex space-x-1 ${className}`}>
      <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`} style={{ animationDelay: '0ms' }}></div>
      <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`} style={{ animationDelay: '150ms' }}></div>
      <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`} style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}

// Komponen Loading Bar untuk progress loading
export function LoadingBar({ 
  progress = 0, 
  className = '',
  showPercentage = false 
}: { 
  progress?: number
  className?: string
  showPercentage?: boolean
}) {
  const [displayProgress, setDisplayProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress)
    }, 100)
    return () => clearTimeout(timer)
  }, [progress])

  return (
    <div className={`w-full ${className}`}>
      {showPercentage && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-ink-mute">Loading</span>
          <span className="text-xs text-ink-mute">{Math.round(displayProgress)}%</span>
        </div>
      )}
      <div className="w-full bg-secondary rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${displayProgress}%` }}
        ></div>
      </div>
    </div>
  )
}
