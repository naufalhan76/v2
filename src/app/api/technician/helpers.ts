import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getUserFromRequest } from '@/app/api/middleware/auth'
import { jsonError } from '@/app/api/utils'
import { logger } from '@/lib/logger'

const log = logger.child('api-technician')

export type TechnicianContext = {
  userId: string
  technicianId: string
}

/**
 * Authenticate request and resolve technician_id.
 * Returns TechnicianContext on success, or a NextResponse error.
 */
export async function authenticateTechnician(
  request: NextRequest
): Promise<TechnicianContext | ReturnType<typeof jsonError>> {
  // 1. Get authenticated user (supports both Bearer token and cookie session)
  const authHeader = request.headers.get('authorization')
  let user = null

  if (authHeader?.startsWith('Bearer ')) {
    user = await getUserFromRequest(request)
  } else {
    // Fall back to cookie session (PWA standalone mode)
    try {
      const supabase = await createClient()
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser()
      user = sessionUser ?? null
    } catch (error) {
      log.error('Cookie auth failed', error)
      user = null
    }
  }

  if (!user) {
    return jsonError('Unauthorized', 401)
  }

  // 2. Verify role is TECHNICIAN
  const supabase = await createClient()
  const { data: userData, error: roleError } = await supabase
    .from('user_management')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (roleError || !userData || userData.role !== 'TECHNICIAN') {
    return jsonError('Forbidden: Technician role required', 403)
  }

  // 3. Resolve technician_id
  const { data: techData, error: techError } = await supabase
    .from('technicians')
    .select('technician_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (techError || !techData) {
    log.error('Technician record not found for user', { userId: user.id })
    return jsonError('Technician profile not found', 404)
  }

  return {
    userId: user.id,
    technicianId: techData.technician_id,
  }
}

/**
 * Type guard: check if result is a TechnicianContext (not an error response).
 */
export function isTechnicianContext(
  result: TechnicianContext | ReturnType<typeof jsonError>
): result is TechnicianContext {
  return 'technicianId' in result
}
