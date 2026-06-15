'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Clock, Command } from 'lucide-react'
import { OrderNotifications } from '@/components/order-notifications'

function JakartaTime() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const jakartaTime = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now)
      
      const jakartaDate = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(now)
      
      setTime(jakartaTime)
      setDate(jakartaDate)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <div className="text-right">
        <div className="font-mono font-medium text-foreground">{time}</div>
        <div className="text-xs">{date}</div>
      </div>
    </div>
  )
}

export function Navbar({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void } = {}) {
  const pathname = usePathname()

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname.startsWith('/dashboard/konfigurasi')) return 'Konfigurasi'
    if (pathname.startsWith('/dashboard/manajemen')) return 'Manajemen'
    if (pathname.startsWith('/dashboard/operasional')) return 'Operasional'
    if (pathname === '/profile') return 'Profile'
    return 'Dashboard'
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:h-[60px] lg:px-6">
      <div className="w-full flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-[460]">
              {getPageTitle()}
            </h1>
          </div>
          
          {/* Notifications and Jakarta Time */}
          <div className="flex items-center gap-3">
            {/* Command Palette Hint */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden md:flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              <Command className="h-3 w-3" />
              <span className="font-medium">K</span>
            </button>

            {/* Order Notifications */}
            <OrderNotifications />
            
            {/* Real-time Jakarta Time - Hidden on small mobile */}
            <div className="hidden sm:block">
              <JakartaTime />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
