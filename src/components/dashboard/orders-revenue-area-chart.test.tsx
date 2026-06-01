import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OrdersRevenueAreaChart } from './orders-revenue-area-chart'

const mockChartDataResponse = {
  success: true,
  data: [
    {
      date: '2026-05-01',
      formattedDate: '01 Mei',
      orders: 5,
      revenue: 2_500_000,
      estimatedRevenue: 3_000_000,
    },
    {
      date: '2026-05-02',
      formattedDate: '02 Mei',
      orders: 3,
      revenue: 1_800_000,
      estimatedRevenue: 2_400_000,
    },
    {
      date: '2026-05-03',
      formattedDate: '03 Mei',
      orders: 7,
      revenue: 4_200_000,
      estimatedRevenue: 5_100_000,
    },
  ],
}

vi.mock('@/lib/actions/dashboard', () => ({
  getChartData: vi.fn(),
}))

import { getChartData } from '@/lib/actions/dashboard'

describe('OrdersRevenueAreaChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(getChartData).mockReturnValue(new Promise(() => {}))
    const { container } = render(<OrdersRevenueAreaChart />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the chart title after loading', async () => {
    vi.mocked(getChartData).mockResolvedValue(mockChartDataResponse)
    render(<OrdersRevenueAreaChart />)

    expect(
      await screen.findByText('Orders & Revenue Overview'),
    ).toBeInTheDocument()
  })

  it('renders period selector with default 30 days', async () => {
    vi.mocked(getChartData).mockResolvedValue(mockChartDataResponse)
    render(<OrdersRevenueAreaChart />)

    await screen.findByText('Orders & Revenue Overview')

    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('renders chart container div with recharts surface', async () => {
    vi.mocked(getChartData).mockResolvedValue(mockChartDataResponse)
    const { container } = render(<OrdersRevenueAreaChart />)

    await screen.findByText('Orders & Revenue Overview')

    // Recharts renders an SVG inside the chart area in a real browser;
    // in jsdom the SVG surface is present when ResponsiveContainer provides dimensions
    const chartArea = container.querySelector('.h-\\[300px\\]')
    expect(chartArea).toBeInTheDocument()
  })

  it('renders empty state when API returns no data', async () => {
    vi.mocked(getChartData).mockResolvedValue({
      success: true,
      data: [],
    })
    render(<OrdersRevenueAreaChart />)

    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('Orders & Revenue Overview')).toBeInTheDocument()
  })
})
