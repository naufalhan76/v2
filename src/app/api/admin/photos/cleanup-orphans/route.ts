import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * POST /api/admin/photos/cleanup-orphans
 *
 * Cleans up orphaned service photos from the storage bucket.
 * Only deletes photos that are:
 * - Not referenced in any service report
 * - Older than 24 hours (grace period for in-flight uploads)
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` required.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('cleanup_orphan_service_photos')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, ...data })
}

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return timingSafeEqual(token, process.env.CRON_SECRET ?? '')
}

/**
 * Constant-time string comparison to avoid timing attacks on the cron secret.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
