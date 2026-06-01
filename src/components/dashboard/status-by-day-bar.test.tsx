import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatusByDayBar, DailyStatusData } from './status-by-day-bar'

function mockDayData(day: number): DailyStatusData {
  const date = `2026-05-${String(day).padStart(2, '0')}`
  return {
    date,
    formattedDate: `${day} Mei`,
    completed: 3 + day,
    in_progress: 2 + day,
    pending: 1 + day,
    cancelled: day,
  }
}

describe('StatusByDayBar', () => {
  it('shows loading skeleton when loading=true', () => {
    const { container } = render(
      <StatusByDayBar data={[]} loading={true} />,
    )

    const card = container.querySelector('.animate-pulse')
    expect(card).toBeInTheDocument()
    expect(card?.querySelector('.h-5')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<StatusByDayBar data={[]} />)

    expect(screen.getByText('Tidak ada data')).toBeInTheDocument()
  })

  it('renders chart title when data is present', () => {
    render(<StatusByDayBar data={[mockDayData(1)]} />)

    expect(screen.getByText('Status per Hari')).toBeInTheDocument()
  })

  it('renders chart container with svg on data', () => {
    const { container } = render(
      <StatusByDayBar data={[mockDayData(1)]} />,
    )

    const chartContainer = container.querySelector(
      '.recharts-responsive-container',
    )
    expect(chartContainer).toBeInTheDocument()
  })

  it('renders Recharts BarChart container from svg', () => {
    const { container } = render(
      <StatusByDayBar data={[mockDayData(1), mockDayData(2)]} />,
    )

    // The ResponsiveContainer renders a div with a recharts-wrapper
    const chartWrapper = container.querySelector('.recharts-responsive-container')
    expect(chartWrapper).toBeInTheDocument()
  })

  it('does not show empty state when data exists', () => {
    render(<StatusByDayBar data={[mockDayData(1)]} />)

    expect(screen.queryByText('Tidak ada data')).not.toBeInTheDocument()
  })
})
