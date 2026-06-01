import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Delta } from './delta'

describe('Delta', () => {
  it('renders positive delta with TrendingUp icon', () => {
    render(<Delta value={15} />)
    const badge = screen.getByText('+15%')
    expect(badge).toBeInTheDocument()
    expect(badge.parentElement).toHaveClass('text-emerald-600')
  })

  it('renders negative delta with TrendingDown icon', () => {
    render(<Delta value={-8} />)
    const badge = screen.getByText('-8%')
    expect(badge).toBeInTheDocument()
    expect(badge.parentElement).toHaveClass('text-red-600')
  })

  it('renders neutral delta (zero) with gray color', () => {
    render(<Delta value={0} />)
    const badge = screen.getByText('0%')
    expect(badge).toBeInTheDocument()
    expect(badge.parentElement).toHaveClass('text-zinc-500')
  })

  it('renders badge variant with rounded-full background', () => {
    const { container } = render(<Delta value={10} variant="badge" />)
    const delta = container.firstChild as HTMLElement
    expect(delta.className).toContain('rounded-full')
    expect(delta.className).toContain('bg-emerald-50')
  })

  it('renders text variant without background', () => {
    const { container } = render(<Delta value={10} variant="text" />)
    const delta = container.firstChild as HTMLElement
    expect(delta.className).toContain('inline-flex')
    expect(delta.className).not.toContain('rounded-full')
  })

  it('renders children slot', () => {
    render(<Delta value={5}>vs last month</Delta>)
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Delta value={5} className="custom-class" />)
    expect((container.firstChild as HTMLElement).className).toContain('custom-class')
  })
})
