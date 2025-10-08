'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface ServicePricing {
  pricing_id: string
  service_type: string
  service_name: string
  base_price: number
  includes: string[] | null
  description: string | null
  duration_minutes: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateServicePricingInput {
  service_type: string
  service_name: string
  base_price: number
  includes?: string[] | null
  description?: string | null
  duration_minutes?: number | null
}

export interface UpdateServicePricingInput {
  service_type?: string
  service_name?: string
  base_price?: number
  includes?: string[] | null
  description?: string | null
  duration_minutes?: number | null
  is_active?: boolean
}

/**
 * Get all service pricing
 */
export async function getServicePricing(): Promise<ServicePricing[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_pricing')
    .select('*')
    .order('service_type', { ascending: true })

  if (error) {
    console.error('Error fetching service pricing:', error)
    throw new Error('Gagal memuat data harga service')
  }

  return data || []
}

/**
 * Get service pricing by ID
 */
export async function getServicePricingById(
  pricingId: string
): Promise<ServicePricing | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_pricing')
    .select('*')
    .eq('pricing_id', pricingId)
    .single()

  if (error) {
    console.error('Error fetching service pricing:', error)
    throw new Error('Gagal memuat data harga service')
  }

  return data
}

/**
 * Get service pricing by service type
 */
export async function getServicePricingByType(
  serviceType: string
): Promise<ServicePricing | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_pricing')
    .select('*')
    .eq('service_type', serviceType)
    .eq('is_active', true)
    .single()

  if (error) {
    // If no pricing found, return null
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching service pricing:', error)
    throw new Error('Gagal memuat data harga service')
  }

  return data
}

/**
 * Create new service pricing
 */
export async function createServicePricing(
  input: CreateServicePricingInput
): Promise<ServicePricing> {
  const supabase = await createClient()

  // Check if service type already exists
  const { data: existing } = await supabase
    .from('service_pricing')
    .select('pricing_id')
    .eq('service_type', input.service_type)
    .single()

  if (existing) {
    throw new Error('Harga untuk jenis service ini sudah ada')
  }

  const { data, error } = await supabase
    .from('service_pricing')
    .insert({
      service_type: input.service_type,
      service_name: input.service_name,
      base_price: input.base_price,
      includes: input.includes || null,
      description: input.description || null,
      duration_minutes: input.duration_minutes || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating service pricing:', error)
    throw new Error('Gagal menambahkan harga service')
  }

  revalidatePath('/dashboard/konfigurasi/service-pricing')
  return data
}

/**
 * Update service pricing
 */
export async function updateServicePricing(
  pricingId: string,
  input: UpdateServicePricingInput
): Promise<ServicePricing> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_pricing')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('pricing_id', pricingId)
    .select()
    .single()

  if (error) {
    console.error('Error updating service pricing:', error)
    throw new Error('Gagal mengupdate harga service')
  }

  revalidatePath('/dashboard/konfigurasi/service-pricing')
  return data
}

/**
 * Delete service pricing
 */
export async function deleteServicePricing(pricingId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('service_pricing')
    .delete()
    .eq('pricing_id', pricingId)

  if (error) {
    console.error('Error deleting service pricing:', error)
    throw new Error('Gagal menghapus harga service')
  }

  revalidatePath('/dashboard/konfigurasi/service-pricing')
}

/**
 * Toggle service pricing status
 */
export async function toggleServicePricingStatus(
  pricingId: string,
  isActive: boolean
): Promise<ServicePricing> {
  return updateServicePricing(pricingId, { is_active: isActive })
}

/**
 * Get active service pricing only
 */
export async function getActiveServicePricing(): Promise<ServicePricing[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_pricing')
    .select('*')
    .eq('is_active', true)
    .order('service_type', { ascending: true })

  if (error) {
    console.error('Error fetching active service pricing:', error)
    throw new Error('Gagal memuat data harga service')
  }

  return data || []
}
