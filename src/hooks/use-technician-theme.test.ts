import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TechnicianThemeProvider, useTechnicianTheme } from './use-technician-theme'

type MatchMediaListener = (event: MediaQueryListEvent) => void

function createMatchMedia(matches: boolean) {
  let isDark = matches
  const listeners = new Set<MatchMediaListener>()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: isDark,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: MatchMediaListener) => listeners.add(listener),
      removeEventListener: (_event: string, listener: MatchMediaListener) => listeners.delete(listener),
      addListener: (listener: MatchMediaListener) => listeners.add(listener),
      removeListener: (listener: MatchMediaListener) => listeners.delete(listener),
      dispatchEvent: () => true,
    })),
  })

  return {
    setDark(nextMatches: boolean) {
      isDark = nextMatches
      const event = { matches: nextMatches, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

function ThemeHarness() {
  const { theme, setTheme, resolvedTheme } = useTechnicianTheme()

  return createElement(
    'div',
    null,
    createElement('div', { 'data-testid': 'theme' }, theme),
    createElement('div', { 'data-testid': 'resolved-theme' }, resolvedTheme),
    createElement('button', { type: 'button', onClick: () => setTheme('light') }, 'Light'),
    createElement('button', { type: 'button', onClick: () => setTheme('dark') }, 'Dark'),
    createElement('button', { type: 'button', onClick: () => setTheme('system') }, 'System')
  )
}

function renderThemeHarness() {
  return render(
    createElement(TechnicianThemeProvider, null, createElement(ThemeHarness))
  )
}

describe('useTechnicianTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
    createMatchMedia(false)
  })

  it('toggles between light, dark, and system', async () => {
    const user = userEvent.setup()
    renderThemeHarness()

    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')

    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')

    await user.click(screen.getByRole('button', { name: 'System' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
  })

  it('persists theme preference to msn-tech-theme', async () => {
    const user = userEvent.setup()
    renderThemeHarness()

    await user.click(screen.getByRole('button', { name: 'Dark' }))

    expect(localStorage.getItem('msn-tech-theme')).toBe('dark')
  })

  it('applies dark class to document element when dark mode is active', async () => {
    const user = userEvent.setup()
    renderThemeHarness()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')

    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('listens to prefers-color-scheme changes while using system theme', () => {
    const media = createMatchMedia(false)
    renderThemeHarness()

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')

    act(() => media.setDark(true))
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')

    act(() => media.setDark(false))
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
