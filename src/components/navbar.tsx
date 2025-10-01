'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AirVent, Menu, Clock } from 'lucide-react'
import { Sidebar } from './sidebar'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname.startsWith('/konfigurasi')) return 'Konfigurasi'
    if (pathname.startsWith('/manajemen')) return 'Manajemen'
    if (pathname.startsWith('/operasional')) return 'Operasional'
    if (pathname === '/profile') return 'Profile'
    return 'Dashboard'
  }

  return (
    <>
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background">
            <div className="flex h-14 items-center border-b px-4">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                <AirVent className="h-6 w-6 text-blue-600" />
                <span>TechService ERP</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => setSidebarOpen(false)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Close sidebar</span>
              </Button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Desktop navbar */}
      <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        
        <div className="w-full flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AirVent className="h-6 w-6 text-blue-600 md:hidden" />
              <h1 className="text-lg font-semibold md:text-xl">
                {getPageTitle()}
              </h1>
            </div>
            
            {/* Real-time Jakarta Time */}
            <JakartaTime />
          </div>
        </div>
      </header>
    </>
  )
}
