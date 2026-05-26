import { NextResponse } from 'next/server'

/**
 * GET /api/technician/push/public-key
 *
 * Returns the VAPID public key. This is intentionally unauthenticated —
 * the public key is meant to be public; treating it as a secret would not
 * add real security. Used by the service worker on `pushsubscriptionchange`.
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  return NextResponse.json({ publicKey })
}
