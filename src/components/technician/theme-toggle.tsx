'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type TechnicianTheme, useTechnicianTheme } from '@/hooks/use-technician-theme'

const options: Array<{ value: TechnicianTheme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function TechnicianThemeToggle() {
  const { theme, setTheme } = useTechnicianTheme()

  return (
    <div className="rounded-2xl border border-[#211c59]/10 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-[#15133d]/90">
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Technician theme">
        {options.map((option) => {
          const Icon = option.icon
          const active = theme === option.value

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors',
                active
                  ? 'bg-[#211c59] text-white shadow-sm dark:bg-indigo-300 dark:text-[#15133d]'
                  : 'text-[#211c59]/70 hover:bg-[#211c59]/5 hover:text-[#211c59] dark:text-indigo-100/70 dark:hover:bg-white/10 dark:hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
