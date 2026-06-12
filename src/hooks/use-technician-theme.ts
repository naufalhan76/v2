'use client'

import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type TechTheme = 'light' | 'dark' | 'system'
export type TechnicianTheme = TechTheme
export type TechnicianResolvedTheme = 'light' | 'dark'

const TECHNICIAN_THEME_KEY = 'msn-tech-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

type TechnicianThemeContextValue = {
  theme: TechnicianTheme
  setTheme: (theme: TechnicianTheme) => void
  resolvedTheme: TechnicianResolvedTheme
}

const TechnicianThemeContext = createContext<TechnicianThemeContextValue | null>(null)

function isTechnicianTheme(value: string | null): value is TechnicianTheme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getSystemTheme(): TechnicianResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(): TechnicianTheme {
  if (typeof window === 'undefined') return 'system'
  const storedTheme = window.localStorage.getItem(TECHNICIAN_THEME_KEY)
  return isTechnicianTheme(storedTheme) ? storedTheme : 'system'
}

function applyResolvedTheme(resolvedTheme: TechnicianResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

export function TechnicianThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<TechnicianTheme>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<TechnicianResolvedTheme>(getSystemTheme)
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    window.localStorage.setItem(TECHNICIAN_THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')

    setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const value = useMemo<TechnicianThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      resolvedTheme,
    }),
    [theme, resolvedTheme]
  )

  return createElement(TechnicianThemeContext.Provider, { value }, children)
}

export function useTechnicianTheme() {
  const context = useContext(TechnicianThemeContext)
  if (!context) {
    throw new Error('useTechnicianTheme must be used within TechnicianThemeProvider')
  }
  return context
}

export function TechnicianThemeScript() {
  const script = `
    (function() {
      try {
        var theme = window.localStorage.getItem('${TECHNICIAN_THEME_KEY}') || 'system';
        var systemDark = window.matchMedia('${DARK_QUERY}').matches;
        var resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
        document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
      } catch (_) {}
    })();
  `

  return createElement('script', { dangerouslySetInnerHTML: { __html: script } })
}
