'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

export type AddonRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface AddonRequest {
  request_id: string
  requested_by_technician_id: string
  category: string
  item_name: string
  proposed_unit_price: number | null
  unit_of_measure: string | null
  description: string | null
  applicable_service_types: string | null
  status: AddonRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  resulting_addon_id: string | null
  created_at: string
  updated_at: string
  technicians?: { technician_name: string } | null
}

export interface CreateAddonRequestInput {
  category: string
  item_name: string
  proposed_unit_price?: number | null
  unit_of_measure?: string | null
  description?: string | null
}

export interface ApproveAddonRequestInput {
  request_id: string
  item_code?: string | null
  final_unit_price: number
  initial_stock?: number
  minimum_stock?: number
}

export async function getAddonRequests(status?: AddonRequestStatus) {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('addon_requests')
      .select('*, technicians(technician_name)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return { success: true, data: (data || []) as AddonRequest[] }
  } catch (error) {
    logger.error('Error fetching addon requests:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat permintaan part',
      data: [] as AddonRequest[],
    }
  }
}

export async function getPendingAddonRequestCount() {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('addon_requests')
      .select('request_id', { count: 'exact', head: true })
      .eq('status', 'PENDING')
    if (error) throw error
    return { success: true, count: count || 0 }
  } catch (error) {
    logger.error('Error counting pending addon requests:', error)
    return { success: false, count: 0 }
  }
}

export async function createAddonRequest(input: CreateAddonRequestInput) {
  try {
    const supabase = await createClient()

    const { data: techData, error: techError } = await supabase
      .from('technicians')
      .select('technician_id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle()

    if (techError || !techData) {
      return { success: false, error: 'Hanya teknisi yang dapat mengajukan part' }
    }

    const { data, error } = await supabase
      .from('addon_requests')
      .insert({
        requested_by_technician_id: techData.technician_id,
        category: input.category,
        item_name: input.item_name,
        proposed_unit_price: input.proposed_unit_price ?? null,
        unit_of_measure: input.unit_of_measure ?? 'pcs',
        description: input.description ?? null,
        status: 'PENDING',
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as AddonRequest }
  } catch (error) {
    logger.error('Error creating addon request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengajukan part',
    }
  }
}

export async function approveAddonRequest(input: ApproveAddonRequestInput) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('approve_addon_request', {
      p_request_id: input.request_id,
      p_item_code: input.item_code ?? '',
      p_final_unit_price: input.final_unit_price,
      p_initial_stock: input.initial_stock ?? 0,
      p_minimum_stock: input.minimum_stock ?? 0,
    })

    if (error) throw error

    revalidatePath('/dashboard/konfigurasi/addons-catalog')
    return { success: true, addonId: data as string }
  } catch (error) {
    logger.error('Error approving addon request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyetujui permintaan',
    }
  }
}

export async function rejectAddonRequest(requestId: string, notes?: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('reject_addon_request', {
      p_request_id: requestId,
      p_notes: notes ?? null,
    })

    if (error) throw error

    revalidatePath('/dashboard/konfigurasi/addons-catalog')
    return { success: true }
  } catch (error) {
    logger.error('Error rejecting addon request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menolak permintaan',
    }
  }
}
