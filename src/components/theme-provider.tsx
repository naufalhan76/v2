'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes'
import { ThemeId, applyTheme, themes } from '@/lib/themes'
import { getUserTheme, saveUserTheme } from '@/lib/actions/theme'

interface ThemeContextType {
  themeId: ThemeId
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const [themeId, setThemeIdState] = React.useState<ThemeId>('navy')
  const [loaded, setLoaded] = React.useState(false)

  const setThemeId = React.useCallback(async (id: ThemeId) => {
    setThemeIdState(id)
    localStorage.setItem('theme-id', id)
    
    const isDark = document.documentElement.classList.contains('dark')
    applyTheme(id, isDark)
    
    // save to DB (fire and forget)
    saveUserTheme(id).catch(() => {})
  }, [])

  // Load from DB first, fallback to localStorage
  React.useEffect(() => {
    getUserTheme()
      .then((dbTheme) => {
        const final = dbTheme || (localStorage.getItem('theme-id') as ThemeId) || 'navy'
        setThemeIdState(final)
        localStorage.setItem('theme-id', final)
        
        const isDark = document.documentElement.classList.contains('dark')
        applyTheme(final, isDark)
        setLoaded(true)
      })
      .catch(() => {
        // fallback localStorage only
        const saved = localStorage.getItem('theme-id') as ThemeId | null
        const final = saved || 'navy'
        setThemeIdState(final)
        
        const isDark = document.documentElement.classList.contains('dark')
        applyTheme(final, isDark)
        setLoaded(true)
      })
  }, [])

  // Watch dark mode changes
  React.useEffect(() => {
    if (!loaded) return

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      applyTheme(themeId, isDark)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [themeId, loaded])

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  const nextTheme = useNextTheme()
  
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  
  return {
    ...context,
    ...nextTheme,
  }
}