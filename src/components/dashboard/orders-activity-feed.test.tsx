import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OrdersActivityFeed } from './orders-activity-feed'

vi.mock('@/lib/actions/dashboard', () => ({
  getRecentOrders: vi.fn(),
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
    status: 'ASSIGNED',
    order_date: '2026-05-11',
    created_at: '2026-05-11T09:00:00.000Z',
    customers: { customer_name: 'Andi Wijaya', phone_number: '0822' },
  },
  {
    order_id: 'o3',
    order_type: 'Bongkar Pasang',
    status: 'EN_ROUTE',
    order_date: '2026-05-12',
    created_at: '2026-05-12T10:00:00.000Z',
    customers: { customer_name: 'Citra Dewi', phone_number: '0833' },
  },
  {
    order_id: 'o4',
    order_type: 'Service AC',
    status: 'IN_PROGRESS',
    order_date: '2026-05-13',
    created_at: '2026-05-13T11:00:00.000Z',
    customers: { customer_name: 'Doni Prasetyo', phone_number: '0844' },
  },
  {
    order_id: 'o5',
    order_type: 'Cuci AC',
    status: 'COMPLETED',
    order_date: '2026-05-14',
    created_at: '2026-05-14T12:00:00.000Z',
    customers: { customer_name: 'Eko Saputra', phone_number: '0855' },
  },
  {
    order_id: 'o6',
    order_type: 'Service AC',
    status: 'CANCELLED',
    order_date: '2026-05-15',
    created_at: '2026-05-15T13:00:00.000Z',
    customers: { customer_name: 'Fajar Hidayat', phone_number: '0866' },
  },
]

describe('OrdersActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetRecentOrders.mockReturnValue(new Promise(() => {}))
    render(<OrdersActivityFeed />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when there are no orders', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: [] })
    render(<OrdersActivityFeed />)

    expect(
      await screen.findByText('Tidak ada order yang perlu perhatian')
    ).toBeInTheDocument()
  })

  it('shows empty state when only terminal statuses are present', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [mockOrders[4], mockOrders[5]],
    })
    render(<OrdersActivityFeed />)

    expect(
      await screen.findByText('Tidak ada order yang perlu perhatian')
    ).toBeInTheDocument()
  })

  it('renders only non-terminal (attention) statuses', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<OrdersActivityFeed />)

    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Andi Wijaya')).toBeInTheDocument()
    expect(screen.getByText('Citra Dewi')).toBeInTheDocument()
    expect(screen.getByText('Doni Prasetyo')).toBeInTheDocument()

    expect(screen.queryByText('Eko Saputra')).not.toBeInTheDocument()
    expect(screen.queryByText('Fajar Hidayat')).not.toBeInTheDocument()
  })

  it('renders status labels for each item', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: mockOrders })
    render(<OrdersActivityFeed />)

    expect(await screen.findByText('Menunggu')).toBeInTheDocument()
    expect(screen.getByText('Ditugaskan')).toBeInTheDocument()
    expect(screen.getByText('Dalam Perjalanan')).toBeInTheDocument()
    expect(screen.getByText('Sedang Dikerjakan')).toBeInTheDocument()
  })

  it('maps legacy status values to canonical attention states', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [
        {
          order_id: 'legacy1',
          order_type: 'Cuci AC',
          status: 'NEW',
          order_date: '2026-05-16',
          created_at: '2026-05-16T14:00:00.000Z',
          customers: { customer_name: 'Legacy User', phone_number: '0877' },
        },
      ],
    })
    render(<OrdersActivityFeed />)

    expect(await screen.findByText('Legacy User')).toBeInTheDocument()
    expect(screen.getByText('Menunggu')).toBeInTheDocument()
  })

  it('normalizes customers returned as an array', async () => {
    mockGetRecentOrders.mockResolvedValue({
      success: true,
      data: [
        {
          order_id: 'arr1',
          order_type: 'Service AC',
          status: 'PENDING',
          order_date: '2026-05-17',
          created_at: '2026-05-17T15:00:00.000Z',
          customers: [{ customer_name: 'Dewi Lestari', phone_number: '0888' }],
        },
      ],
    })
    render(<OrdersActivityFeed />)

    expect(await screen.findByText('Dewi Lestari')).toBeInTheDocument()
  })

  it('shows empty state when the request fails', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: false, error: 'Boom' })
    render(<OrdersActivityFeed />)

    expect(
      await screen.findByText('Tidak ada order yang perlu perhatian')
    ).toBeInTheDocument()
  })

  it('passes the limit to the server action', async () => {
    mockGetRecentOrders.mockResolvedValue({ success: true, data: [] })
    render(<OrdersActivityFeed limit={20} />)

    await screen.findByText('Tidak ada order yang perlu perhatian')
    expect(mockGetRecentOrders).toHaveBeenCalledWith(20)
  })

  it('does not throw when unmounted mid-fetch', () => {
    mockGetRecentOrders.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<OrdersActivityFeed />)

    expect(() => unmount()).not.toThrow()
  })
})
