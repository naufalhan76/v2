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
    <div className="fixed inset-x-6 bottom-4 z-50 pb-safe pointer-events-none">
      <nav
        className="pointer-events-auto bg-white rounded-3xl shadow-[0_4px_15px_rgba(0,0,0,0.05)]"
        aria-label="Navigasi utama"
      >
        <div className="mx-auto flex items-center justify-around h-[72px] px-2">
          {tabs.map((tab) => {
            const active = isActive(tab)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'group flex flex-col items-center justify-center gap-1 transition-transform duration-200 active:scale-[0.96]',
                  active ? 'bg-navy-deep text-white rounded-xl py-3 px-4 flex-1 font-semibold' : 'text-gray-600 font-semibold py-3 flex-1 text-center'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    active ? 'text-white' : 'text-gray-400'
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-xs transition-colors duration-200',
                    active ? 'text-white' : 'text-gray-500'
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
