'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface User {
  user_id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  invite_id?: string
  invite_status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
  row_type?: 'user' | 'invite'
  created_at?: string
  updated_at?: string
}

export interface InviteUserInput {
  email: string
  role: string
}

export interface CreateUserInput {
  email: string
  password: string
  full_name: string
  role: string
}

export interface UpdateUserInput {
  user_id: string
  full_name?: string
  role?: string
}

/**
 * Get all users from user_management table
 */
export async function getUsers() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_management')
      .select('user_id, full_name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching users:', error)
      return { users: [], error: error.message }
    }

    const { data: invites, error: invitesError } = await supabase
      .from('user_invites')
      .select('invite_id, email, role, status, invited_at, updated_at')
      .eq('status', 'PENDING')
      .order('invited_at', { ascending: false })

    if (invitesError) {
      logger.error('Error fetching user invites:', invitesError)
      return { users: [], error: invitesError.message }
    }

    const inviteRows: User[] = (invites ?? []).map((invite) => ({
      user_id: '-', // ponytail: MSN ID only exists after acceptInvite creates user_management row
      invite_id: invite.invite_id,
      full_name: '-',
      email: invite.email,
      role: invite.role,
      is_active: false,
      invite_status: invite.status,
      row_type: 'invite',
      created_at: invite.invited_at,
      updated_at: invite.updated_at,
    }))
    const userRows: User[] = (data as User[]).map((user) => ({ ...user, row_type: 'user' }))

    return { users: [...inviteRows, ...userRows], error: null }
  } catch (error) {
    logger.error('Unexpected error in getUsers:', error)
    return { users: [], error: 'Failed to fetch users' }
  }
}
