import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AddressPickerInner } from './address-picker-inner'
import { searchAddress } from '@/lib/geo/nominatim'

// Mock react-leaflet safely
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({
    setView: vi.fn()
  })
}))

// Mock API
vi.mock('@/lib/geo/nominatim', () => ({
  searchAddress: vi.fn()
}))

describe('AddressPickerInner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('renders safely and displays default empty instructions', () => {
    render(<AddressPickerInner value={{ lat: null, lng: null }} onChange={vi.fn()} />)
    expect(screen.getByText('Klik saran atau geser peta untuk menentukan titik')).toBeDefined()
  })

  it('updates coordinates but does not change search query text on suggestion click', async () => {
    vi.useFakeTimers()
    const mockedSearch = vi.mocked(searchAddress)
    mockedSearch.mockResolvedValueOnce([
      { place_id: 1, display_name: 'Test Place', lat: -6.1, lng: 106.8 }
    ])

    const onChangeMock = vi.fn()
    const { findByText, getByDisplayValue } = render(
      <AddressPickerInner value={{ lat: null, lng: null }} onChange={onChangeMock} suggestionsQuery="test" />
    )

    // Advance debounce timer
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    // Switch back to real timers so findByText (waitFor) works correctly
    vi.useRealTimers()

    // Wait for the debounced search to resolve and suggestion to appear
    const suggestionBtn = await findByText('Test Place')
    
    // Click suggestion
    fireEvent.click(suggestionBtn)

    // Ensure onChange is called with ONLY coordinates
    expect(onChangeMock).toHaveBeenCalledWith({ lat: -6.1, lng: 106.8 })
    
    // Ensure search input value is STILL "test", not "Test Place"
    expect(getByDisplayValue('test')).toBeDefined()
  })
})
