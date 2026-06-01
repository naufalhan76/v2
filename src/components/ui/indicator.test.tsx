import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatusIndicator } from './indicator'

describe('StatusIndicator', () => {
  it('renders emerald dot by default', () => {
    const { container } = render(<StatusIndicator />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('bg-emerald-500')
    expect(dot.className).toContain('h-2')
    expect(dot.className).toContain('w-2')
    expect(dot.className).toContain('rounded-full')
  })

  it('renders amber dot', () => {
    const { container } = render(<StatusIndicator color="amber" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('bg-amber-500')
  })

  it('renders red dot', () => {
    const { container } = render(<StatusIndicator color="red" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('bg-red-500')
  })

  it('renders blue dot', () => {
    const { container } = render(<StatusIndicator color="blue" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('bg-blue-500')
  })

  it('adds pulse animation when pulse=true', () => {
    const { container } = render(<StatusIndicator pulse={true} />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('animate-pulse')
  })

  it('does not add pulse animation when pulse=false', () => {
    const { container } = render(<StatusIndicator pulse={false} />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).not.toContain('animate-pulse')
  })

  it('applies custom className', () => {
    const { container } = render(<StatusIndicator className="custom-class" />)
    const dot = container.firstChild as HTMLElement
    expect(dot.className).toContain('custom-class')
  })
})
