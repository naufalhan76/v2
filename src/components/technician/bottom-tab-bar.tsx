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
    <nav
      className="fixed inset-x-0 bottom-0 z-50 bg-[#1b1938] pb-safe rounded-t-lg"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex max-w-md items-center justify-around h-huge px-2">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="group flex flex-1 flex-col items-center justify-center gap-1 h-full transition-transform duration-200 active:scale-[0.96]"
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    active ? 'text-violet-soft' : 'text-white/80'
                  )}
                  aria-hidden="true"
                />
                {active && (
                  <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-violet-soft" />
                )}
              </span>
              <span
                className={cn(
                  'text-xs font-[540] transition-colors duration-200',
                  active ? 'text-violet-soft' : 'text-white/80'
                )}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
