'use server'

import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { auditLog } from '@/lib/audit'

// ============================================================================
// TYPES
// ============================================================================

export type AllowedEmail = {
  email: string
  added_by: string | null
  added_at: string
}

export type AllowedDomain = {
  domain: string
  added_by: string | null
  added_at: string
}

export type BlockedSignup = {
  id: number
  email: string
  clerk_user_id: string
  reason: string
  blocked_at: string
}

// ============================================================================
// ALLOWED EMAILS
// ============================================================================

export async function listAllowedEmails(): Promise<AllowedEmail[]> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('allowed_emails')
      .select('email, added_by, added_at')
      .order('added_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('listAllowedEmails failed:', error)
    return []
  }
}

export async function addAllowedEmail(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const normalized = email.trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) {
      return { success: false, error: 'Email tidak valid' }
    }
    const supabase = await createClient()
    const { error } = await supabase
      .from('allowed_emails')
      .insert({ email: normalized })
    if (error) {
      if (error.code === '23505') return { success: false, error: 'Email sudah ada di allowlist' }
      throw error
    }
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('CREATE', 'allowed_emails', normalized)
    return { success: true, error: null }
  } catch (error) {
    logger.error('addAllowedEmail failed:', error)
    return { success: false, error: 'Gagal menambah email' }
  }
}

export async function removeAllowedEmail(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('allowed_emails')
      .delete()
      .eq('email', email)
    if (error) throw error
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('DELETE', 'allowed_emails', email)
    return { success: true, error: null }
  } catch (error) {
    logger.error('removeAllowedEmail failed:', error)
    return { success: false, error: 'Gagal menghapus email' }
  }
}

// ============================================================================
// ALLOWED DOMAINS
// ============================================================================

export async function listAllowedDomains(): Promise<AllowedDomain[]> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('allowed_domains')
      .select('domain, added_by, added_at')
      .order('added_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('listAllowedDomains failed:', error)
    return []
  }
}

export async function addAllowedDomain(domain: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const normalized = domain.trim().toLowerCase().replace(/^@/, '')
    if (!normalized || !normalized.includes('.')) {
      return { success: false, error: 'Domain tidak valid' }
    }
    const supabase = await createClient()
    const { error } = await supabase
      .from('allowed_domains')
      .insert({ domain: normalized })
    if (error) {
      if (error.code === '23505') return { success: false, error: 'Domain sudah ada di allowlist' }
      throw error
    }
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('CREATE', 'allowed_domains', normalized)
    return { success: true, error: null }
  } catch (error) {
    logger.error('addAllowedDomain failed:', error)
    return { success: false, error: 'Gagal menambah domain' }
  }
}

export async function removeAllowedDomain(domain: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('allowed_domains')
      .delete()
      .eq('domain', domain)
    if (error) throw error
    revalidatePath('/dashboard/manajemen/user')
    void auditLog('DELETE', 'allowed_domains', domain)
    return { success: true, error: null }
  } catch (error) {
    logger.error('removeAllowedDomain failed:', error)
    return { success: false, error: 'Gagal menghapus domain' }
  }
}

// ============================================================================
// BLOCKED SIGNUPS LOG
// ============================================================================

export async function listBlockedSignups(limit: number = 50): Promise<BlockedSignup[]> {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('blocked_signups')
      .select('id, email, clerk_user_id, reason, blocked_at')
      .order('blocked_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('listBlockedSignups failed:', error)
    return []
  }
}
