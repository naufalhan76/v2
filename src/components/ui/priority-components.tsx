'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// Komponen Hero Image dengan fetchpriority high
interface HeroImageProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  onLoad?: () => void
  onError?: () => void
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

export function HeroImage({
  src,
  alt,
  className = '',
  priority = true,
  fill = false,
  width,
  height,
  sizes,
  onLoad,
  onError,
  placeholder = 'empty',
  blurDataURL
}: HeroImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }

  if (fill) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <Image
          src={src}
          alt={alt}
          fill
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          priority={priority}
          sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          onLoad={handleLoad}
          onError={handleError}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <div className="text-center p-4">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Failed to load image</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width || 400}
        height={height || 300}
        className={cn(
          'object-cover transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        priority={priority}
        sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
        onLoad={handleLoad}
        onError={handleError}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="text-center p-4">
            <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Komponen untuk Critical CSS dengan inline styles
interface CriticalCSSProps {
  children: React.ReactNode
  className?: string
}

export function CriticalCSS({ children, className = '' }: CriticalCSSProps) {
  return (
    <div className={cn('critical-css', className)} style={{ 
      // Critical CSS untuk mencegah FOUC (Flash of Unstyled Content)
      opacity: 1,
      transition: 'opacity 0.3s ease-in-out'
    }}>
      {children}
    </div>
  )
}

// Komponen untuk Preload Critical Resources
interface PreloadResourceProps {
  href: string
  as: 'script' | 'style' | 'font' | 'image'
  type?: string
  crossOrigin?: string
  integrity?: string
}

export function PreloadResource({ 
  href, 
  as, 
  type, 
  crossOrigin, 
  integrity 
}: PreloadResourceProps) {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    
    if (type) link.type = type
    if (crossOrigin) link.crossOrigin = crossOrigin
    if (integrity) link.integrity = integrity
    
    document.head.appendChild(link)
    
    return () => {
      document.head.removeChild(link)
    }
  }, [href, as, type, crossOrigin, integrity])
  
  return null
}

// Komponen untuk Priority Script Loading
interface PriorityScriptProps {
  src: string
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload'
  onLoad?: () => void
  onError?: () => void
  children?: React.ReactNode
}

export function PriorityScript({ 
  src, 
  strategy = 'afterInteractive',
  onLoad,
  onError,
  children 
}: PriorityScriptProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (strategy === 'beforeInteractive') {
      // Script akan dimuat sebelum interaksi
      const script = document.createElement('script')
      script.src = src
      script.async = false
      script.defer = false
      
      script.onload = () => {
        setIsLoaded(true)
        onLoad?.()
      }
      
      script.onerror = () => {
        setHasError(true)
        onError?.()
      }
      
      document.head.appendChild(script)
    } else if (strategy === 'afterInteractive') {
      // Script akan dimuat setelah interaksi
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      
      script.onload = () => {
        setIsLoaded(true)
        onLoad?.()
      }
      
      script.onerror = () => {
        setHasError(true)
        onError?.()
      }
      
      document.body.appendChild(script)
    } else if (strategy === 'lazyOnload') {
      // Script akan dimuat saat idle
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          const script = document.createElement('script')
          script.src = src
          script.async = true
          
          script.onload = () => {
            setIsLoaded(true)
            onLoad?.()
          }
          
          script.onerror = () => {
            setHasError(true)
            onError?.()
          }
          
          document.body.appendChild(script)
        })
      }
    }
  }, [src, strategy, onLoad, onError])

  if (children) {
    return (
      <>
        {!isLoaded && !hasError && (
          <div className="script-placeholder">
            {children}
          </div>
        )}
        {hasError && (
          <div className="script-error text-red-500 text-sm">
            Failed to load critical script
          </div>
        )}
      </>
    )
  }

  return null
}

// Komponen untuk DNS Prefetch dan Preconnect
interface ResourceHintsProps {
  domains: string[]
  fonts?: string[]
}

export function ResourceHints({ domains, fonts = [] }: ResourceHintsProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // DNS Prefetch untuk domain eksternal
    domains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = `//${domain}`
      document.head.appendChild(link)
    })

    // Preconnect untuk domain penting
    domains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = `https://${domain}`
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })

    // Preload font penting
    fonts.forEach(font => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.href = font
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })

    return () => {
      // Cleanup
      try {
        const links = document.querySelectorAll('link[rel="dns-prefetch"], link[rel="preconnect"], link[rel="preload"][as="font"]')
        links.forEach(link => link.remove())
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, [domains, fonts])

  return null
}

// Komponen untuk Hero Section dengan optimasi loading
interface HeroSectionProps {
  children: React.ReactNode
  backgroundImage?: string
  className?: string
  priority?: boolean
}

export function HeroSection({ 
  children, 
  backgroundImage, 
  className = '',
  priority = true 
}: HeroSectionProps) {
  return (
    <section className={cn('relative overflow-hidden', className)}>
      {backgroundImage && (
        <HeroImage
          src={backgroundImage}
          alt=""
          fill
          className="absolute inset-0 z-0"
          priority={priority}
          sizes="100vw"
        />
      )}
      <div className="relative z-10">
        <CriticalCSS>
          {children}
        </CriticalCSS>
      </div>
    </section>
  )
}