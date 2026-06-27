'use client'

import 'leaflet/dist/leaflet.css'
import './leaflet-icon-fix'

import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { DEFAULT_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from '@/lib/geo/constants'

type AddressPickerReadOnlyInnerProps = {
  lat: number | null
  lng: number | null
}

const VISIBLE_ATTRIBUTION = '© OpenStreetMap contributors'

export function AddressPickerReadOnlyInner({ lat, lng }: AddressPickerReadOnlyInnerProps) {
  if (lat === null || lng === null) {
    return (
      <div className="mt-2 text-sm text-muted-foreground italic">
        Belum ada pinpoint
      </div>
    )
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="h-[180px] overflow-hidden rounded-sm border border-border bg-surface-muted relative z-0">
        <MapContainer
          center={[lat, lng]}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          <Marker position={[lat, lng]} interactive={false} />
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground font-mono" role="status">
        Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)} · {VISIBLE_ATTRIBUTION}
      </p>
    </div>
  )
}
