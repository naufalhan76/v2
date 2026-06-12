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
    <div className="rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#1a1833]">
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
                  : 'text-[#211c59] hover:bg-gray-100 hover:text-[#211c59] dark:text-indigo-200 dark:hover:bg-[#252243] dark:hover:text-white'
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
