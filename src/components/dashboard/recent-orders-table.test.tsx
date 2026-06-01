import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RecentOrdersTable } from './recent-orders-table'

vi.mock('@/lib/actions/dashboard', () => ({
  getRecentOrders: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { getRecentOrders } from '@/lib/actions/dashboard'

const mockGetRecentOrders = getRecentOrders as unknown as ReturnType<typeof vi.fn>

const mockOrders = [
  {
    order_id: 'o1',
    order_type: 'Cuci AC',
    status: 'PENDING',
    order_date: '2026-05-10',
    created_at: '2026-05-10T08:00:00.000Z',
    customers: { customer_name: 'Budi Santoso', phone_number: '0811' },
  },
  {
    order_id: 'o2',
    order_type: 'Service AC',
    status: 'COMPLETED',
    order_date: '2026-05-11',
    created_at: '2026-05-11T09:00:00.000Z',
    customers: { customer_name: 'Andi Wijaya', phone_number: '0822' },
  },
  {
    order_id: 'o3',
    order_type: 'Bongkar Pasang',
    status: 'CANCELLED',
    order_date: '2026-05-12',
    created_at: '2026-05-12T10:00:00.000Z',
    customers: { customer_name: 'Citra Dewi', phone_number: '0833' },
  },
]

describe('RecentOrdersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetRecentOrders.mockReturnValue(new Promise(() => {}))
    render(<RecentOrdersTable />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when there are no orders', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: [] })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Belum ada order')).toBeInTheDocument()
  })

  it('shows empty state when the request fails', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: false, error: 'Boom' })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Belum ada order')).toBeInTheDocument()
  })

  it('renders column headers', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Pelanggan')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Layanan')).toBeInTheDocument()
    expect(screen.getByText('Tanggal')).toBeInTheDocument()
  })

  it('renders customer names and service types', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Andi Wijaya')).toBeInTheDocument()
    expect(screen.getByText('Cuci AC')).toBeInTheDocument()
    expect(screen.getByText('Service AC')).toBeInTheDocument()
  })

  it('renders translated status labels', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Menunggu')).toBeInTheDocument()
    expect(screen.getByText('Selesai')).toBeInTheDocument()
    expect(screen.getByText('Dibatalkan')).toBeInTheDocument()
  })

  it('applies amber color tokens for PENDING status badge', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [mockOrders[0]],
    })
    render(<RecentOrdersTable />)

    const badge = await screen.findByText('Menunggu')
    expect(badge.className).toContain('bg-amber-100')
  })

  it('handles a missing customer relation gracefully', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [
        {
          order_id: 'o9',
          order_type: 'Cuci AC',
          status: 'ASSIGNED',
          order_date: '2026-05-13',
          created_at: '2026-05-13T11:00:00.000Z',
          customers: null,
        },
      ],
    })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Unknown')).toBeInTheDocument()
  })

  it('normalizes customers returned as an array', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [
        {
          order_id: 'o10',
          order_type: 'Service AC',
          status: 'EN_ROUTE',
          order_date: '2026-05-14',
          created_at: '2026-05-14T12:00:00.000Z',
          customers: [{ customer_name: 'Dewi Lestari', phone_number: '0844' }],
        },
      ],
    })
    render(<RecentOrdersTable />)

    expect(await screen.findByText('Dewi Lestari')).toBeInTheDocument()
  })

  it('renders a link to all orders', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<RecentOrdersTable />)

    const link = await screen.findByText('Lihat semua order')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/orders')
  })

  it('passes the limit to the server action', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: [] })
    render(<RecentOrdersTable limit={8} />)

    await screen.findByText('Belum ada order')
    expect(mockGetRecentOrders).toHaveBeenCalledWith(8)
  })

  it('does not throw when unmounted mid-fetch', () => {
    mockGetRecentOrders.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<RecentOrdersTable />)

    expect(() => unmount()).not.toThrow()
  })
})
