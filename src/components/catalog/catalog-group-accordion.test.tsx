import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'

import { CatalogGroupAccordion } from './catalog-group-accordion'
import type { ServiceCatalogEntry, UnitTypeOption, CapacityRangeOption, ServiceTypeOption } from '@/lib/actions/service-catalog'

// ============================================================
// MOCK DATA
// ============================================================

const mockUnitTypes: UnitTypeOption[] = [
  { unit_type_id: 'u1', name: 'AC Split' },
  { unit_type_id: 'u2', name: 'AC Central' },
  { unit_type_id: 'u3', name: 'Cassette' },
]

const mockCapacityRanges: CapacityRangeOption[] = [
  { capacity_id: 'c1', unit_type_id: 'u1', capacity_label: '1/2 PK' },
  { capacity_id: 'c2', unit_type_id: 'u1', capacity_label: '1 PK' },
  { capacity_id: 'c3', unit_type_id: 'u2', capacity_label: '5 PK' },
]

const mockServiceTypes: ServiceTypeOption[] = [
  { service_type_id: 's1', name: 'Check & Cleaning', code: 'CC' },
  { service_type_id: 's2', name: 'Repair', code: 'RPR' },
]

const mockCatalogEntries: ServiceCatalogEntry[] = [
  {
    catalog_id: 'cat-1',
    msn_code: 'SPLIT001',
    unit_type_id: 'u1',
    capacity_id: 'c1',
    service_type_id: 's1',
    service_name: 'Service AC Split 1/2 PK',
    base_price: 150000,
    includes: ['Cek freon', 'Bersihkan filter'],
    description: null,
    duration_minutes: 60,
    is_active: true,
    unit_types: { name: 'AC Split' },
    capacity_ranges: { capacity_label: '1/2 PK' },
    service_types: { name: 'Check & Cleaning', code: 'CC' },
  },
  {
    catalog_id: 'cat-2',
    msn_code: 'SPLIT002',
    unit_type_id: 'u1',
    capacity_id: 'c2',
    service_type_id: 's2',
    service_name: 'Service AC Split 1 PK',
    base_price: 200000,
    includes: null,
    description: 'Repair ringan',
    duration_minutes: 90,
    is_active: true,
    unit_types: { name: 'AC Split' },
    capacity_ranges: { capacity_label: '1 PK' },
    service_types: { name: 'Repair', code: 'RPR' },
  },
  {
    catalog_id: 'cat-3',
    msn_code: 'CENTR001',
    unit_type_id: 'u2',
    capacity_id: 'c3',
    service_type_id: 's1',
    service_name: 'Service AC Central 5 PK',
    base_price: 500000,
    includes: ['Cek freon', 'Bersihkan evaporator'],
    description: null,
    duration_minutes: 120,
    is_active: false,
    unit_types: { name: 'AC Central' },
    capacity_ranges: { capacity_label: '5 PK' },
    service_types: { name: 'Check & Cleaning', code: 'CC' },
  },
]

const mockGroupedData: Record<string, ServiceCatalogEntry[]> = {
  'AC Split': [mockCatalogEntries[0], mockCatalogEntries[1]],
  'AC Central': [mockCatalogEntries[2]],
}

// ============================================================
// MOCKS
// ============================================================

vi.mock('@/lib/actions/service-catalog', () => ({
  getCatalogGrouped: vi.fn(),
  getCatalogLookups: vi.fn(),
  createCatalogEntry: vi.fn(),
  updateCatalogEntry: vi.fn(),
  toggleCatalogActive: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

import { getCatalogGrouped, getCatalogLookups, toggleCatalogActive } from '@/lib/actions/service-catalog'

// ============================================================
// TEST WRAPPER
// ============================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// ============================================================
// TESTS
// ============================================================

describe('CatalogGroupAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(getCatalogGrouped).mockReturnValue(new Promise(() => {}))
    vi.mocked(getCatalogLookups).mockReturnValue(new Promise(() => {}))
    const { container } = render(<CatalogGroupAccordion />, { wrapper: createWrapper() })
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders empty state when no data', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: {} })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: [], capacityRanges: [], serviceTypes: [] },
    })

    render(<CatalogGroupAccordion />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Tidak ada catalog entry')).toBeInTheDocument()
    })
  })

  it('renders accordion sections grouped by unit type', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('AC Split')).toBeInTheDocument()
      expect(screen.getByText('AC Central')).toBeInTheDocument()
    })

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('expands accordion and shows table when defaultExpandedTypes is passed', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('SPLIT001')).toBeInTheDocument()
    })

    expect(screen.getByText('SPLIT002')).toBeInTheDocument()
    expect(screen.getByText('1/2 PK')).toBeInTheDocument()
    expect(screen.getByText('CC')).toBeInTheDocument()
  })

  it('renders price formatted as IDR currency', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('150.000'))).toBeInTheDocument()
      expect(screen.getByText((content) => content.includes('200.000'))).toBeInTheDocument()
    })
  })

  it('renders active/inactive badges', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Central']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Nonaktif')).toBeInTheDocument()
    })
  })

  it('renders edit buttons with Pencil icons', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText('Edit')
      expect(editButtons.length).toBe(2)
    })
  })

  it('renders toggle Switch for each row', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      const switches = screen.getAllByRole('switch')
      expect(switches.length).toBe(2)
    })
  })

  it('opens edit Sheet when edit button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('SPLIT001')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByLabelText('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Catalog Entry')).toBeInTheDocument()
    })

    const msnInput = screen.getByPlaceholderText('CARERA001') as HTMLInputElement
    expect(msnInput.value).toBe('SPLIT001')
  })

  it('renders error state when API fails', async () => {
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: false, error: 'DB connection failed' })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: [], capacityRanges: [], serviceTypes: [] },
    })

    render(<CatalogGroupAccordion />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Gagal memuat catalog')).toBeInTheDocument()
      expect(screen.getByText('DB connection failed')).toBeInTheDocument()
    })

    expect(screen.getByText('Coba lagi')).toBeInTheDocument()
  })

  it('calls toggleCatalogActive when Switch is toggled', async () => {
    const user = userEvent.setup()
    vi.mocked(getCatalogGrouped).mockResolvedValue({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })
    vi.mocked(toggleCatalogActive).mockResolvedValue({ success: true, data: { ...mockCatalogEntries[0], is_active: false } })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split']} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('SPLIT001')).toBeInTheDocument()
    })

    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])

    await waitFor(() => {
      expect(toggleCatalogActive).toHaveBeenCalledWith('cat-1', false)
    })
  })

  it('filters data when search input is submitted', async () => {
    const user = userEvent.setup()
    vi.mocked(getCatalogGrouped).mockResolvedValueOnce({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogGrouped).mockResolvedValueOnce({
      success: true,
      data: { 'AC Central': [mockCatalogEntries[2]] },
    })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion defaultExpandedTypes={['AC Split', 'AC Central']} />, { wrapper: createWrapper() })

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('SPLIT001')).toBeInTheDocument()
    })

    // Type search
    const searchInput = screen.getByPlaceholderText('Cari MSN Code atau Nama Service...')
    await user.type(searchInput, 'CENTR')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(getCatalogGrouped).toHaveBeenCalledWith({ search: 'CENTR' })
    })
  })

  it('shows search placeholder and empty state message when search yields no results', async () => {
    const user = userEvent.setup()
    vi.mocked(getCatalogGrouped).mockResolvedValueOnce({ success: true, data: mockGroupedData })
    vi.mocked(getCatalogGrouped).mockResolvedValueOnce({ success: true, data: {} })
    vi.mocked(getCatalogLookups).mockResolvedValue({
      success: true,
      data: { unitTypes: mockUnitTypes, capacityRanges: mockCapacityRanges, serviceTypes: mockServiceTypes },
    })

    render(<CatalogGroupAccordion />, { wrapper: createWrapper() })

    const searchInput = await screen.findByPlaceholderText('Cari MSN Code atau Nama Service...')
    expect(searchInput).toBeInTheDocument()

    // Type something that won't match
    await user.type(searchInput, 'ZZZZZ')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Tidak ada catalog entry')).toBeInTheDocument()
      expect(screen.getByText('Tidak ada hasil untuk pencarian saat ini.')).toBeInTheDocument()
    })
  })

  it('has default export that matches named export', async () => {
    const DefaultExport = (await import('./catalog-group-accordion')).default
    expect(DefaultExport).toBe(CatalogGroupAccordion)
  })
})
