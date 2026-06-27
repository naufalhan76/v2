'use client'

import 'leaflet/dist/leaflet.css'
import './leaflet-icon-fix'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { Input } from '@/components/ui/input'
import { DEFAULT_ZOOM, JAKARTA_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL } from '@/lib/geo/constants'
import { searchAddress, type NominatimResult } from '@/lib/geo/nominatim'

export type AddressPickerValue = { lat: number | null; lng: number | null }

type AddressPickerProps = {
  value: AddressPickerValue
  onChange: (value: { lat: number; lng: number }) => void
  suggestionsQuery?: string
}

const NO_SUGGESTIONS = 'Tidak ada saran'
const VISIBLE_ATTRIBUTION = '© OpenStreetMap contributors'
const EMPTY_INSTRUCTION = 'Klik saran atau geser peta untuk menentukan titik'

function selectedPosition(value: AddressPickerValue): { lat: number; lng: number } {
  return value.lat === null || value.lng === null ? JAKARTA_CENTER : { lat: value.lat, lng: value.lng }
}

function MapController({ value }: { value: AddressPickerValue }) {
  const map = useMap()

  useEffect(() => {
    const next = selectedPosition(value)
    map.setView([next.lat, next.lng], DEFAULT_ZOOM)
  }, [map, value])

  return null
}

export function AddressPickerInner({ value, onChange, suggestionsQuery = '' }: AddressPickerProps) {
  const [query, setQuery] = useState(suggestionsQuery)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showNoSuggestions, setShowNoSuggestions] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const markerPosition = useMemo(() => selectedPosition(value), [value])
  const statusText =
    value.lat === null || value.lng === null
      ? EMPTY_INSTRUCTION
      : `Lat: ${value.lat.toFixed(6)}, Lng: ${value.lng.toFixed(6)} · ${VISIBLE_ATTRIBUTION}`

  useEffect(() => {
    setQuery(suggestionsQuery)
  }, [suggestionsQuery])

  useEffect(() => {
    abortRef.current?.abort()
    setSuggestions([])
    setShowNoSuggestions(false)

    const trimmedQuery = query.trim()
    if (!trimmedQuery) return undefined

    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = window.setTimeout(() => {
      void searchAddress(trimmedQuery, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          const nextSuggestions = results.slice(0, 5)
          setSuggestions(nextSuggestions)
          setShowNoSuggestions(nextSuggestions.length === 0)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof Error && error.name === 'AbortError') return
          setSuggestions([])
          setShowNoSuggestions(true)
        })
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query])

  const handlePick = (suggestion: NominatimResult) => {
    setSuggestions([])
    setShowNoSuggestions(false)
    onChange({ lat: suggestion.lat, lng: suggestion.lng })
  }

  const handleMarkerDrag = (event: L.LeafletEvent) => {
    const marker = event.target as L.Marker
    const next = marker.getLatLng()
    onChange({ lat: next.lat, lng: next.lng })
  }

  return (
    <div className="space-y-3">
      <label className="space-y-2 block">
        <span className="text-sm font-medium text-foreground">Cari alamat</span>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari alamat atau titik lokasi"
          autoComplete="off"
        />
      </label>

      {suggestions.length > 0 || showNoSuggestions ? (
        <ul className="rounded-sm border border-border bg-surface text-sm shadow-sm" aria-label="Saran alamat">
          {showNoSuggestions ? (
            <li className="px-3 py-2 text-muted-foreground">{NO_SUGGESTIONS}</li>
          ) : null}
          {suggestions.map((suggestion) => (
            <li key={suggestion.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-foreground transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => handlePick(suggestion)}
              >
                {suggestion.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="h-72 overflow-hidden rounded-sm border border-border bg-surface-muted">
        <MapContainer center={[markerPosition.lat, markerPosition.lng]} zoom={DEFAULT_ZOOM} className="h-full w-full">
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          <Marker position={[markerPosition.lat, markerPosition.lng]} draggable eventHandlers={{ dragend: handleMarkerDrag }} />
          <MapController value={value} />
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        {statusText}
      </p>
    </div>
  )
}
