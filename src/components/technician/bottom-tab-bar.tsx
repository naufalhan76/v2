'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock, User } from 'lucide-react'
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
    icon: Clock,
    matchExact: false,
  },
  {
    label: 'Profil',
    href: '/technician/profile',
    icon: User,
    matchExact: false,
  },
] as const

export function BottomTabBar() {
  const pathname = usePathname()

  // Hide tab bar on focused task routes (e.g. wizard) so it doesn't cover
  // their fixed bottom navigation bars.
  if (pathname?.includes('/job/') && pathname?.endsWith('/complete')) {
    return null
  }

  function isActive(tab: (typeof tabs)[number]) {
    if (tab.matchExact) {
      return pathname === tab.href
    }
    return pathname.startsWith(tab.href)
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 z-50 pb-safe pointer-events-none">
      <nav
        className="pointer-events-auto bg-white dark:bg-surface-muted rounded-[32px] shadow-2xl p-2 flex justify-between items-center"
        aria-label="Navigasi utama"
      >
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group flex flex-col items-center justify-center transition-transform duration-200 active:scale-[0.96] min-h-[44px]',
                active 
                  ? 'bg-primary rounded-[28px] py-2 flex-1 mx-1 px-8 text-white' 
                  : 'py-2 flex-1 mx-1 text-muted-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-6 w-6 transition-colors duration-200',
                  active ? 'text-white' : 'text-muted-foreground'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium transition-colors duration-200',
                  active ? 'text-white' : 'text-muted-foreground'
                )}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
