/**
 * GPS capture utility — best-effort, never throws.
 *
 * Used by technician transition buttons to attach an audit coordinate to
 * every EN_ROUTE / IN_PROGRESS status change. A denied or unavailable
 * location never blocks the transition; the error reason is recorded instead.
 */

export type GpsResult = {
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  captured_at: string | null
  gps_error: 'denied' | 'timeout' | 'unavailable' | 'unsupported' | null
}

const NULL_COORDS: Omit<GpsResult, 'gps_error'> = {
  lat: null,
  lng: null,
  accuracy_m: null,
  captured_at: null,
}

/**
 * Attempt to capture the device's current GPS position.
 *
 * @param opts.timeoutMs  Maximum ms to wait for a fix (default 5000).
 * @returns               Always resolves — never rejects.
 */
export async function captureGps(
  opts?: { timeoutMs?: number }
): Promise<GpsResult> {
  const timeoutMs = opts?.timeoutMs ?? 5_000

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ...NULL_COORDS, gps_error: 'unsupported' }
  }

  return new Promise<GpsResult>((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ...NULL_COORDS, gps_error: 'timeout' })
    }, timeoutMs)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer)
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy ?? null,
          captured_at: new Date().toISOString(),
          gps_error: null,
        })
      },
      (err) => {
        clearTimeout(timer)
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ...NULL_COORDS, gps_error: 'denied' })
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          resolve({ ...NULL_COORDS, gps_error: 'unavailable' })
        } else if (err.code === err.TIMEOUT) {
          resolve({ ...NULL_COORDS, gps_error: 'timeout' })
        } else {
          resolve({ ...NULL_COORDS, gps_error: 'unavailable' })
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    )
  })
}
