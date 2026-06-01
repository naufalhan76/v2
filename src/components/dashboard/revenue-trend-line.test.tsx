import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RevenueTrendLine } from './revenue-trend-line'

vi.mock('@/lib/actions/dashboard', () => ({
  getChartData: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  formatRupiah: (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount),
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
}))

import { getChartData } from '@/lib/actions/dashboard'

const mockGetChartData = getChartData as unknown as ReturnType<typeof vi.fn>

function createChartPoint(day: number) {
  const date = `2026-05-${String(day).padStart(2, '0')}`
  return {
    date,
    formattedDate: `${day} Mei`,
    orders: 3 + day,
    revenue: 5000000 + day * 1000000,
    estimatedRevenue: 6000000 + day * 1000000,
  }
}

describe('RevenueTrendLine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetChartData.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<RevenueTrendLine startDate="2026-05-01" endDate="2026-05-07" />)

    // Should have pulse animation class during loading (CardTitle is hidden in skeleton)
    const card = container.querySelector('.animate-pulse')
    expect(card).toBeInTheDocument()
    expect(card?.querySelector('.h-5')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', async () => {
    mockGetChartData.mockResolvedValue({ success: true, data: [] })
    render(<RevenueTrendLine startDate="2026-05-01" endDate="2026-05-07" />)

    const emptyText = await screen.findByText('Tidak ada data')
    expect(emptyText).toBeInTheDocument()
  })

  it('shows empty state when request fails', async () => {
    mockGetChartData.mockResolvedValue({ success: false, error: 'Failed' })
    render(<RevenueTrendLine startDate="2026-05-01" endDate="2026-05-07" />)

    const emptyText = await screen.findByText('Tidak ada data')
    expect(emptyText).toBeInTheDocument()
  })

  it('renders chart with last 7 data points', async () => {
    const allData = Array.from({ length: 10 }, (_, i) => createChartPoint(i + 1))
    mockGetChartData.mockResolvedValue({ success: true, data: allData })

    render(<RevenueTrendLine startDate="2026-05-01" endDate="2026-05-10" />)

    await waitFor(() => {
      expect(screen.getByText('Tren Pendapatan (7 Hari)')).toBeInTheDocument()
    })
  })

  it('re-fetches when dates change', async () => {
    mockGetChartData.mockResolvedValue({ success: true, data: [] })
    const { rerender } = render(
      <RevenueTrendLine startDate="2026-05-01" endDate="2026-05-07" />
    )

    await screen.findByText('Tidak ada data')
    expect(mockGetChartData).toHaveBeenCalledWith('2026-05-01', '2026-05-07')

    rerender(<RevenueTrendLine startDate="2026-05-08" endDate="2026-05-14" />)

    // Should call again with new dates
    await screen.findByText('Tidak ada data')
    expect(mockGetChartData).toHaveBeenCalledWith('2026-05-08', '2026-05-14')
  })

  it('cancels fetch on unmount', () => {
    mockGetChartData.mockReturnValue(new Promise(() => {})) // never resolves
    const { unmount } = render(
      <RevenueTrendLine startDate="2026-05-01" endDate="2026-05-07" />
    )

    // Should not throw when unmounting mid-fetch
    expect(() => unmount()).not.toThrow()
  })
})
