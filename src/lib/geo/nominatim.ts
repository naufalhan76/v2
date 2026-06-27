export type NominatimResult = {
  readonly display_name: string
  readonly lat: number
  readonly lng: number
  readonly place_id: number
}

type NominatimResponseItem = {
  readonly display_name: string
  readonly lat: string
  readonly lon: string
  readonly place_id: number
}

const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'msn-erp-webpanel/1.0 (contact: admin@msn-erp)'

export async function searchAddress(query: string, signal: AbortSignal): Promise<NominatimResult[]> {
  const url = new URL('/search', process.env.NEXT_PUBLIC_NOMINATIM_BASE_URL ?? DEFAULT_NOMINATIM_BASE_URL)
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', 'id')
  url.searchParams.set('addressdetails', '0')

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`)
  }
  const results = (await response.json()) as NominatimResponseItem[]

  return results
    .map((result) => ({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      place_id: result.place_id,
    }))
    .filter((result) => !Number.isNaN(result.lat) && !Number.isNaN(result.lng))
}
