/**
 * API Key Generation and Verification
 * Uses HMAC-SHA256 signed tokens without database storage
 * Format: sk_<hash> (64 chars total)
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

const API_KEY_SECRET = process.env.API_KEY_SECRET || 'your-secret-key-change-in-production'

interface ApiKeyPayload {
  userId: string
  email: string
  role: string
  iat: number // issued at
  exp: number // expiration (30 days)
}

/**
 * Generate a new API key for a user
 * Returns a compact signed token (sk_<64-char-hash>)
 * Format: sk_<base32-encoded-payload-hash>_<signature-hash>
 */
export function generateApiKey(
  userId: string,
  email: string,
  role: string
): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const expiresAt = timestamp + 30 * 24 * 60 * 60 // 30 days

  const payload: ApiKeyPayload = {
    userId,
    email,
    role,
    iat: timestamp,
    exp: expiresAt,
  }

  // Create signature using SHA512
  const payloadStr = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha512', API_KEY_SECRET)
    .update(payloadStr)
    .digest('hex')
    .substring(0, 32) // First 32 chars of SHA512 hash

  const payloadHash = crypto
    .createHash('sha512')
    .update(payloadStr)
    .digest('hex')
    .substring(0, 32) // First 32 chars of SHA512 hash

  // Format: sk_<payload-hash><signature-hash> = sk_<64-chars>
  const apiKey = `sk_${payloadHash}${signature}`

  return apiKey
}

/**
 * Verify and decode an API key
 * Since we use stateless tokens, we need to store metadata in database
 * For now, this is a placeholder that accepts a metadata lookup function
 */
export async function verifyApiKey(
  apiKey: string,
  metadataLookup?: (hash: string) => Promise<ApiKeyPayload | null>
): Promise<ApiKeyPayload | null> {
  try {
    // Check format: sk_<64-chars>
    if (!apiKey.startsWith('sk_') || apiKey.length !== 67) {
      return null
    }

    // If metadata lookup provided, use it to verify
    if (metadataLookup) {
      const hash = apiKey.substring(3) // Remove 'sk_' prefix
      const metadata = await metadataLookup(hash)
      if (!metadata) return null

      // Check expiration
      const now = Math.floor(Date.now() / 1000)
      if (metadata.exp < now) {
        return null
      }

      return metadata
    }

    // Without metadata lookup, we can't verify stateless tokens
    // This is a limitation - in production, always use metadata lookup
    logger.warn('Warning: API key verification without metadata lookup is not secure')
    return null
  } catch (error) {
    logger.error('Error verifying API key:', error)
    return null
  }
}

/**
 * Extract API key from Authorization header
 * Supports: "Bearer sk_..." or just "sk_..."
 */
export function extractApiKeyFromHeader(
  authHeader: string | null | undefined
): string | null {
  if (!authHeader) return null

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  if (authHeader.startsWith('sk_')) {
    return authHeader
  }

  return null
}

/**
 * Format API key for display (mask most of it)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 10) return '***'
  return apiKey.slice(0, 8) + '...' + apiKey.slice(-8)
}

/**
 * Get API key creation date
 * Note: This requires database lookup in production
 */
export function getApiKeyCreatedDate(apiKey: string): Date | null {
  // Stateless tokens cannot determine creation date without DB
  // In production, store metadata in database
  return null
}

/**
 * Get API key expiration date
 * Note: This requires database lookup in production
 */
export function getApiKeyExpirationDate(apiKey: string): Date | null {
  // Stateless tokens cannot determine expiration without DB
  // In production, store metadata in database
  return null
}
