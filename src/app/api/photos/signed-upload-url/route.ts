import { NextRequest } from 'next/server'
import { requireApiRole } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { jsonSuccess, jsonError } from '@/app/api/utils'

const ALLOWED_BUCKETS = ['service-photos', 'signatures'] as const
const ALLOWED_ROLES = ['TECHNICIAN', 'ADMIN', 'SUPERADMIN'] as const

// ponytail: path regex is intentionally narrow — only hex-uuid filenames with image extensions, prefix allows slashes for orderId format (REQ/YYYY-MM/NNNNNN).
// Upgrade path: extend regex or move to zod schema if more patterns are needed.
const PATH_RE = () =>
  /^[a-zA-Z0-9_\/-]+\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpe?g|png|webp)$/

export async function POST(req: NextRequest) {
  const log = logger.child('signed-upload-url')

  const auth = await requireApiRole(req, ALLOWED_ROLES)
  if (!auth.authorized) {
    log.warn('Unauthorized/forbidden access attempt')
    return auth.response
  }

  const userId = auth.user.id
  log.info('Signed upload URL requested', { userId })

  const body = await req.json().catch(() => ({}))
  const { bucket, path, contentType } = body as {
    bucket?: string
    path?: string
    contentType?: string
  }

  if (!bucket || !path) {
    return jsonError('bucket and path are required', 400)
  }

  if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
    return jsonError(`Bucket not allowed. Allowed: ${ALLOWED_BUCKETS.join(', ')}`, 400)
  }

  if (!PATH_RE().test(path)) {
    return jsonError('Invalid path. Must be <prefix>/[uuid].(jpg|jpeg|png|webp)', 400)
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true })

  if (error) {
    log.error('Failed to create signed upload URL', error)
    return jsonError(error.message, 500)
  }

  return jsonSuccess({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  })
}
