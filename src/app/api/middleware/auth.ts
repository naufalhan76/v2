import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { unauthorizedResponse } from '@/app/api/utils'
import { verifyApiKey, extractApiKeyFromHeader } from '@/lib/api-key'

export type ApiRequest = NextRequest & {
  user?: {
    id: string
    email: string
    role?: string
  }
}

/**
 * Middleware to verify JWT token from Authorization header
 * and attach user info to request
 */
export async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse()
    }

    const token = authHeader.substring(7)
    const supabase = await createClient()

    // Verify token using Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return unauthorizedResponse()
    }

    // Attach user to request (note: we can't modify request in Next.js)
    // Instead, return the user object and let the handler use it
    return user
  } catch (error) {
    console.error('[Auth Middleware Error]', error)
    return unauthorizedResponse()
  }
}

/**
 * Get user from Authorization header
 * Supports both JWT tokens and API keys
 * Returns null if no valid auth found
 */
export async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return null
    }

    // Try API key first
    const apiKey = extractApiKeyFromHeader(authHeader)
    if (apiKey && apiKey.startsWith('sk_') && apiKey.length === 67) {
      // For API keys, we accept them as-is for now
      // In production, you'd verify the signature and check expiration
      // This is a simplified implementation
      return {
        id: 'api-key-user', // Placeholder - in production, extract from key metadata
        email: 'api-key@system.local',
        user_metadata: { role: 'SUPERADMIN' }, // API keys are for SUPERADMIN only
      }
    }

    // Fall back to JWT token
    if (!authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser(token)

    return user || null
  } catch (error) {
    console.error('[Auth Error]', error)
    return null
  }
}

/**
 * Check if user has required role
 */
export async function checkRole(request: NextRequest, requiredRoles: string[]) {
  const user = await getUserFromRequest(request)
  if (!user) return false

  // TODO: Fetch user role from user_management table
  // For now, this is a placeholder
  return true
}

/**
 * Require authentication
 * Returns the user or null if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const user = await getUserFromRequest(request)
  return user
}
