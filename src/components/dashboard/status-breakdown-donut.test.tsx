import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatusBreakdownDonut } from './status-breakdown-donut'

vi.mock('@/lib/actions/dashboard', () => ({
  getStatusBreakdown: vi.fn(),
}))

import { getStatusBreakdown } from '@/lib/actions/dashboard'

const mockGetStatusBreakdown = getStatusBreakdown as unknown as ReturnType<
  typeof vi.fn
>

function mockBreakdown(data: Record<string, number>) {
  return { success: true, data }
}

describe('StatusBreakdownDonut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetStatusBreakdown.mockReturnValue(new Promise(() => {}))
    const { container } = render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    const card = container.querySelector('.animate-pulse')
    expect(card).toBeInTheDocument()
    expect(card?.querySelector('.h-5')).toBeInTheDocument()
  })

  it('shows empty state when breakdown is empty', async () => {
    mockGetStatusBreakdown.mockResolvedValue(mockBreakdown({}))
    render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    const emptyText = await screen.findByText('Tidak ada data')
    expect(emptyText).toBeInTheDocument()
  })

  it('shows empty state when request fails', async () => {
    mockGetStatusBreakdown.mockResolvedValue({ success: false, error: 'Fail' })
    render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    const emptyText = await screen.findByText('Tidak ada data')
    expect(emptyText).toBeInTheDocument()
  })

  it('renders chart title after loading', async () => {
    mockGetStatusBreakdown.mockResolvedValue(
      mockBreakdown({ COMPLETED: 10, PENDING: 5, CANCELLED: 2 }),
    )
    render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    await waitFor(() => {
      expect(screen.getByText('Distribusi Status Order')).toBeInTheDocument()
    })
  })

  it('renders recharts container with data loaded', async () => {
    mockGetStatusBreakdown.mockResolvedValue(
      mockBreakdown({ COMPLETED: 10, PENDING: 5, CANCELLED: 2 }),
    )
    const { container } = render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    await waitFor(() => {
      const chartContainer = container.querySelector(
        '.recharts-responsive-container',
      )
      expect(chartContainer).toBeInTheDocument()
    })
  })

  it('re-fetches when dates change', async () => {
    mockGetStatusBreakdown.mockResolvedValue(mockBreakdown({}))
    const { rerender } = render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    await screen.findByText('Tidak ada data')
    expect(mockGetStatusBreakdown).toHaveBeenCalledWith(
      '2026-05-01',
      '2026-05-07',
    )

    rerender(
      <StatusBreakdownDonut startDate="2026-05-08" endDate="2026-05-14" />,
    )

    await screen.findByText('Tidak ada data')
    expect(mockGetStatusBreakdown).toHaveBeenCalledWith(
      '2026-05-08',
      '2026-05-14',
    )
  })

  it('cancels fetch on unmount', () => {
    mockGetStatusBreakdown.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(
      <StatusBreakdownDonut startDate="2026-05-01" endDate="2026-05-07" />,
    )

    expect(() => unmount()).not.toThrow()
  })
})
