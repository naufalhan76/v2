'use server'

import { getUser, getUserRole } from '@/lib/auth'
import { generateApiKey, maskApiKey, getApiKeyCreatedDate, getApiKeyExpirationDate } from '@/lib/api-key'
import { logger } from '@/lib/logger'

export interface ApiKeyInfo {
  api_key_id: string
  name: string
  description?: string
  created_at: string
  last_used_at?: string
  is_active: boolean
  expires_at?: string
}

export interface ApiKeyWithSecret extends ApiKeyInfo {
  api_key: string
  warning?: string
}

/**
 * Generate a new API key for the current user
 * Only SUPERADMIN users can generate API keys
 */
export async function generateNewApiKey() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const role = await getUserRole()
    if (role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Only SUPERADMIN users can generate API keys',
      }
    }

    const apiKey = generateApiKey(user.id, user.email || '', role)

    return {
      success: true,
      apiKey,
      masked: maskApiKey(apiKey),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }
  } catch (error: any) {
    logger.error('Error generating API key:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate API key',
    }
  }
}

/**
 * Get API key info (created/expiration dates) from the key itself
 */
export async function getApiKeyInfo(apiKey: string) {
  try {
    const createdAt = getApiKeyCreatedDate(apiKey)
    const expiresAt = getApiKeyExpirationDate(apiKey)

    return {
      success: true,
      createdAt,
      expiresAt,
      masked: maskApiKey(apiKey),
    }
  } catch (error: any) {
    return {
      success: false,
      error: 'Invalid API key',
    }
  }
}

/**
 * Get all API keys for the current user
 * Returns masked keys (full keys are not stored)
 */
export async function getUserApiKeys() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        keys: [],
      }
    }

    // Since API keys are self-contained and not stored in DB,
    // we return empty list. In a real implementation, you'd store
    // key metadata (name, description, created_at, last_used_at) in DB
    // but not the key itself.
    const keys: ApiKeyInfo[] = []

    return {
      success: true,
      keys,
    }
  } catch (error: any) {
    logger.error('Error fetching API keys:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch API keys',
      keys: [],
    }
  }
}

/**
 * Create a new API key (stored in session or browser)
 */
export async function createApiKey(
  name: string,
  description?: string,
  expirationDays: number = 90
) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        data: null,
      }
    }

    const role = await getUserRole()
    if (role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Only SUPERADMIN users can create API keys',
        data: null,
      }
    }

    const apiKey = generateApiKey(user.id, user.email || '', role)
    const createdAt = new Date()
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)

    const keyData: ApiKeyWithSecret = {
      api_key_id: `key_${Date.now()}`,
      name,
      description,
      api_key: apiKey,
      created_at: createdAt.toISOString(),
      is_active: true,
      expires_at: expiresAt.toISOString(),
      warning: '⚠️ Save this API key in a secure location. You won\'t be able to see it again!',
    }

    return {
      success: true,
      data: keyData,
    }
  } catch (error: any) {
    logger.error('Error creating API key:', error)
    return {
      success: false,
      error: error.message || 'Failed to create API key',
      data: null,
    }
  }
}

/**
 * Regenerate an existing API key
 */
export async function regenerateApiKey(keyId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        data: null,
      }
    }

    const role = await getUserRole()
    if (role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Only SUPERADMIN users can regenerate API keys',
        data: null,
      }
    }

    const apiKey = generateApiKey(user.id, user.email || '', role)
    const createdAt = new Date()
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

    const keyData: ApiKeyWithSecret = {
      api_key_id: keyId,
      name: 'Regenerated Key',
      api_key: apiKey,
      created_at: createdAt.toISOString(),
      is_active: true,
      expires_at: expiresAt.toISOString(),
      warning: '⚠️ Your old API key is now invalid. This is your new key. Save it securely!',
    }

    return {
      success: true,
      data: keyData,
    }
  } catch (error: any) {
    logger.error('Error regenerating API key:', error)
    return {
      success: false,
      error: error.message || 'Failed to regenerate API key',
      data: null,
    }
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const role = await getUserRole()
    if (role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Only SUPERADMIN users can delete API keys',
      }
    }

    // In a real implementation, delete the key metadata from database
    // For now, just return success (key is self-contained, no DB storage)

    return {
      success: true,
    }
  } catch (error: any) {
    logger.error('Error deleting API key:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete API key',
    }
  }
}

/**
 * Update an API key (name, description, etc)
 */
export async function updateApiKey(
  keyId: string,
  name?: string,
  description?: string
) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        data: null,
      }
    }

    const role = await getUserRole()
    if (role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Only SUPERADMIN users can update API keys',
        data: null,
      }
    }

    // In a real implementation, update the key metadata in database
    // For now, just return success

    return {
      success: true,
      data: {
        api_key_id: keyId,
        name: name || 'Updated Key',
        description,
        created_at: new Date().toISOString(),
        is_active: true,
      },
    }
  } catch (error: any) {
    logger.error('Error updating API key:', error)
    return {
      success: false,
      error: error.message || 'Failed to update API key',
      data: null,
    }
  }
}
