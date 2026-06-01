import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatsCards } from './stats-cards'

const mockKpisData = {
  success: true,
  data: {
    totalOrders: 142,
    pendingOrders: 18,
    completedOrders: 97,
    cancelledOrders: 27,
    totalCustomers: 85,
    totalTechnicians: 12,
    totalRevenue: 45_000_000,
    estimatedRevenue: 52_000_000,
    unpaidTransactions: 5,
    previous: {
      totalOrders: 120,
      pendingOrders: 22,
      completedOrders: 80,
      cancelledOrders: 18,
      totalCustomers: 70,
      totalTechnicians: 10,
      totalRevenue: 38_000_000,
      estimatedRevenue: 44_000_000,
      unpaidTransactions: 8,
    },
    windowDays: 30,
  },
}

vi.mock('@/lib/actions/dashboard', () => ({
  getDashboardKpis: vi.fn(),
}))

import { getDashboardKpis } from '@/lib/actions/dashboard'

describe('StatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(getDashboardKpis).mockReturnValue(new Promise(() => {}))
    const { container } = render(<StatsCards />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders 4 KPI cards with correct values after loading', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue(mockKpisData)
    render(<StatsCards />)

    expect(await screen.findByText('Total Orders')).toBeInTheDocument()
    expect(screen.getByText('Pending Orders')).toBeInTheDocument()
    expect(screen.getByText('Completed Orders')).toBeInTheDocument()
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()

    expect(screen.getByText('142')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('97')).toBeInTheDocument()

    const positiveDeltas = screen.getAllByText('+18%')
    expect(positiveDeltas.length).toBe(2)
    expect(screen.getByText('-18%')).toBeInTheDocument()
    expect(screen.getByText('+21%')).toBeInTheDocument()
  })

  it('renders revenue formatted with formatRupiah', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue(mockKpisData)
    render(<StatsCards />)

    await screen.findByText('Total Revenue')
    expect(screen.getByText((content) => content.includes('45.000.000'))).toBeInTheDocument()
  })

  it('renders ArrowRight icons on each card', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue(mockKpisData)
    render(<StatsCards />)

    await screen.findByText('Total Orders')
    const arrows = document.querySelectorAll('svg.lucide-arrow-right')
    expect(arrows.length).toBe(4)
  })

  it('renders empty state when API fails', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue({ success: false, error: 'Failed' })
    render(<StatsCards />)

    await new Promise((r) => setTimeout(r, 50))
    const labels = document.querySelectorAll('.uppercase')
    expect(labels.length).toBe(0)
  })
})
