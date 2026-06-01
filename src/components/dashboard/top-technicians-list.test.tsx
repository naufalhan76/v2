import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TopTechniciansList } from './top-technicians-list'

// Mock the server action
vi.mock('@/lib/actions/dashboard', () => ({
  getTopTechnicians: vi.fn(),
}))

import { getTopTechnicians } from '@/lib/actions/dashboard'

const mockGetTopTechnicians = getTopTechnicians as unknown as ReturnType<typeof vi.fn>

const mockTechnicians = [
  { id: 't1', name: 'Budi Santoso', completed: 18, total: 20 },
  { id: 't2', name: 'Andi Wijaya', completed: 15, total: 18 },
  { id: 't3', name: 'Citra Dewi', completed: 12, total: 12 },
  { id: 't4', name: 'Doni Prasetyo', completed: 8, total: 15 },
  { id: 't5', name: 'Eko Saputra', completed: 5, total: 14 },
  { id: 't6', name: 'Fajar Hidayat', completed: 10, total: 10 },
  { id: 't7', name: 'Gita Permata Sari', completed: 7, total: 8 },
  { id: 't8', name: 'Hadi Nugroho', completed: 3, total: 10 },
  { id: 't9', name: 'Indra Kusuma', completed: 9, total: 11 },
  { id: 't10', name: 'Joko Widodo', completed: 1, total: 2 },
]

describe('TopTechniciansList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetTopTechnicians.mockReturnValue(new Promise(() => {}))
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', async () => {
    mockGetTopTechnicians.mockResolvedValue({ success: true, data: [] })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    const emptyText = await screen.findByText('Belum ada data teknisi')
    expect(emptyText).toBeInTheDocument()
  })

  it('shows empty state when request fails', async () => {
    mockGetTopTechnicians.mockResolvedValue({ success: false, error: 'Failed', data: [] })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    const emptyText = await screen.findByText('Belum ada data teknisi')
    expect(emptyText).toBeInTheDocument()
  })

  it('renders list of top technicians', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: mockTechnicians.slice(0, 3),
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    // Wait for names to appear
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Andi Wijaya')).toBeInTheDocument()
    expect(screen.getByText('Citra Dewi')).toBeInTheDocument()
  })

  it('shows completion stats for each technician', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [mockTechnicians[0]], // Budi: 18/20
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    // Check that count text is present
    expect(await screen.findByText(/18 selesai/)).toBeInTheDocument()
    expect(screen.getByText(/20 total/)).toBeInTheDocument()

    // Check rate badge (90%)
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('renders emerald rate badge for >=80%', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [{ id: 't1', name: 'Budi', completed: 18, total: 20 }],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Budi')
    const badge = screen.getByText('90%')
    expect(badge.className).toContain('bg-emerald-100')
  })

  it('renders amber rate badge for >=50%', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [{ id: 't4', name: 'Doni', completed: 8, total: 15 }],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Doni')
    const badge = screen.getByText('53%')
    expect(badge.className).toContain('bg-amber-100')
  })

  it('renders red rate badge for <50%', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [{ id: 't5', name: 'Eko', completed: 5, total: 14 }],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Eko')
    const badge = screen.getByText('36%')
    expect(badge.className).toContain('bg-red-100')
  })

  it('renders dropdown menu trigger button for each technician', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [mockTechnicians[0]],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Budi Santoso')

    const trigger = document.querySelector('[aria-label*="Menu"]')
    expect(trigger).toBeInTheDocument()
  })

  it('handles zero total orders with 0% rate', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [{ id: 't99', name: 'Zero Tech', completed: 0, total: 0 }],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Zero Tech')
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('re-fetches when dates change', async () => {
    mockGetTopTechnicians.mockResolvedValue({ success: true, data: [] })
    const { rerender } = render(
      <TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />
    )

    await screen.findByText('Belum ada data teknisi')
    expect(mockGetTopTechnicians).toHaveBeenCalledWith('2026-05-01', '2026-05-07', 10)

    rerender(<TopTechniciansList startDate="2026-05-08" endDate="2026-05-14" />)

    await screen.findByText('Belum ada data teknisi')
    expect(mockGetTopTechnicians).toHaveBeenCalledWith('2026-05-08', '2026-05-14', 10)
  })

  it('cancels fetch on unmount', () => {
    mockGetTopTechnicians.mockReturnValue(new Promise(() => {})) // never resolves
    const { unmount } = render(
      <TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />
    )

    // Should not throw when unmounting mid-fetch
    expect(() => unmount()).not.toThrow()
  })

  it('generates initials from name', async () => {
    mockGetTopTechnicians.mockResolvedValue({
      success: true,
      data: [
        { id: 't7', name: 'Gita Permata Sari', completed: 7, total: 8 },
      ],
    })
    render(<TopTechniciansList startDate="2026-05-01" endDate="2026-05-07" />)

    await screen.findByText('Gita Permata Sari')
    const initials = screen.getByText('GP')
    expect(initials).toBeInTheDocument()
  })
})
