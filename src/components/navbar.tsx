'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'

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

export function Navbar() {
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
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <div className="w-full flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold md:text-xl">
              {getPageTitle()}
            </h1>
          </div>
          
          {/* Real-time Jakarta Time - Hidden on small mobile */}
          <div className="hidden sm:block">
            <JakartaTime />
          </div>
        </div>
      </div>
    </header>
  )
}
