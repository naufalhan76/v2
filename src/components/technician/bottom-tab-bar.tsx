'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, History, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  {
    label: 'Hari Ini',
    href: '/technician',
    icon: CalendarDays,
    matchExact: true,
  },
  {
    label: 'Riwayat',
    href: '/technician/history',
    icon: History,
    matchExact: false,
  },
  {
    label: 'Profil',
    href: '/technician/profile',
    icon: UserCircle,
    matchExact: false,
  },
] as const

export function BottomTabBar() {
  const pathname = usePathname()

  function isActive(tab: (typeof tabs)[number]) {
    if (tab.matchExact) {
      return pathname === tab.href
    }
    return pathname.startsWith(tab.href)
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                'min-h-[56px] justify-center', // 56px touch target
                active
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
