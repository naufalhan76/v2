'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

const options: { value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function TechnicianThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return null
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-1 shadow-sm dark:border-border dark:bg-surface-muted">
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
                  ? 'bg-primary text-primary-foreground shadow-sm dark:bg-primary dark:text-primary-foreground'
                  : 'text-foreground hover:bg-muted hover:text-foreground dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground'
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
