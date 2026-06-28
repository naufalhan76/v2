'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export interface TechnicianProfile {
  technician_id: string
  technician_name: string
  contact_number: string | null
  email: string | null
  company: string | null
}

export async function getMyTechnicianProfile(): Promise<TechnicianProfile | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('technicians')
    .select('technician_id, technician_name, contact_number, email, company')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) {
    logger.error('getMyTechnicianProfile: query failed', error)
    return null
  }

  return data as TechnicianProfile | null
}

export async function getMyTechnicianId(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('technicians')
    .select('technician_id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  // ponytail: fallback to clerk userId when no technicians row exists —
  // ceiling: caller may persist this as auth_user_id; upgrade path is ensuring
  // a technicians row is always seeded at user creation.
  return data?.technician_id ?? userId
}

export interface TechnicianStats {
  totalCompleted: number
  monthCompleted: number
}

export async function getTechnicianStats(technicianId: string | null): Promise<TechnicianStats> {
  if (!technicianId) {
    return { totalCompleted: 0, monthCompleted: 0 }
  }

  const supabase = await createClient()
  const [lifetimeRes, monthRes] = await Promise.all([
    supabase
      .from('service_reports')
      .select('report_id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .is('deleted_at', null),
    supabase
      .from('service_reports')
      .select('report_id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .is('deleted_at', null)
      .gte('submitted_at', startOfMonthIso()),
  ])

  return {
    totalCompleted: lifetimeRes.count ?? 0,
    monthCompleted: monthRes.count ?? 0,
  }
}
