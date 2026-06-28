'use server'

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface User {
  user_id: string
  auth_user_id: string | null
  full_name: string
  email: string
  role: string
  is_active: boolean
  row_type: 'user'
  created_at?: string
  updated_at?: string
}

export interface InviteUserInput {
  email: string
  role: string
}

export interface CreateUserInput {
  email: string
  password?: string // ponytail: ignored — Clerk sends set-password email regardless
  full_name: string
  role: string
}

export interface UpdateUserInput {
  user_id: string
  full_name?: string
  role?: string
}

export async function getUsers() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_management')
      .select('user_id, auth_user_id, full_name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching users:', error)
      return { users: [], error: error.message }
    }

    const users: User[] = (data ?? []).map((u) => ({ ...u, row_type: 'user' as const }))
    return { users, error: null }
  } catch (error) {
    logger.error('Unexpected error in getUsers:', error)
    return { users: [], error: 'Failed to fetch users' }
  }
}
