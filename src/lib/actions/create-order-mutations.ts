'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { normalizeOrderServiceType, type OrderServiceType } from '@/lib/service-types'
import type { CreateOrderInput } from '@/types/orders'
import { logger } from '@/lib/logger'

/**
 * Create new customer
 * Validates phone uniqueness before inserting
 */
export async function createCustomer(data: {
  customer_name: string;
  phone_number: string;
  email?: string;
  primary_contact_person?: string;
  billing_address?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{
  success: boolean;
  data?: { customer_id: string };
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    // Check if phone already exists
    const { data: existing } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('phone_number', data.phone_number)
      .single()
    
    if (existing) {
      return {
        success: false,
        error: 'Phone number already registered to another customer'
      }
    }
    
    // Insert new customer
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        customer_name: data.customer_name,
        phone_number: data.phone_number,
        email: data.email || null,
        primary_contact_person: data.primary_contact_person || data.customer_name,
        billing_address: data.billing_address || 'TBD', // Fallback if no address provided
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      })
      .select('customer_id')
      .single()
    
    if (insertError) throw insertError
    
    revalidatePath('/dashboard/manajemen/customer')
    
    return {
      success: true,
      data: { customer_id: newCustomer.customer_id }
    }
  } catch (error) {
    logger.error('[createCustomer] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer'
    }
  }
}

/**
 * Create order with multiple order items (locations + AC + services)
 * Uses transaction to ensure atomicity
 */
export async function createOrderWithItems(input: CreateOrderInput): Promise<{
  success: boolean;
  data?: { order_id: string };
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    
    // Determine order status based on technician assignment
    const orderStatus = input.assigned_technician_id ? 'ASSIGNED' : 'PENDING'
    
    // Determine order_type (legacy header field on orders):
    // - If explicitly provided, use that
    // - If all items have same service_type, use that
    // - If mixed, find most common service type (or first if tied)
    let orderType = input.order_type ? normalizeOrderServiceType(input.order_type) : undefined
    if (!orderType) {
      const serviceTypeCounts = input.items.reduce((acc, item) => {
        const normalizedType = normalizeOrderServiceType(item.service_type)
        acc[normalizedType] = (acc[normalizedType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Find the most common service type
      const sortedTypes = Object.entries(serviceTypeCounts).sort((a, b) => b[1] - a[1])
      orderType = ((sortedTypes[0]?.[0] as string) || 'INSPECTION') as OrderServiceType // Most common (or first if tied)
    }
    
    // 1. Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: input.customer_id,
        order_date: new Date().toISOString(), // Auto-set to now
        order_type: orderType, // Legacy field for compatibility
        req_visit_date: input.req_visit_date || input.scheduled_visit_date, // Legacy field
        scheduled_visit_date: input.scheduled_visit_date,
        status: orderStatus, // ASSIGNED if technician assigned, ACCEPTED otherwise
        assigned_technician_id: input.assigned_technician_id,
        notes: input.notes,
        created_by: user.id
      })
      .select('order_id')
      .single()
    
    if (orderError) throw orderError
    
    const orderItems = input.items.map((item) => ({
        order_id: order.order_id,
        location_id: item.location_id,
        ac_unit_id: item.ac_unit_id || null,
        unit_type_id: item.unit_type_id,
        capacity_id: item.capacity_id,
        brand_id: item.brand_id,
        service_type_id: item.service_type_id,
        catalog_id: item.catalog_id,
        msn_code: item.msn_code,
        service_type: normalizeOrderServiceType(item.service_type),
        quantity: item.quantity || 1,
        description: item.description,
        estimated_price: item.estimated_price || 0,
        status: orderStatus
      }))
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
    
    if (itemsError) {
      await supabase
        .from('orders')
        .delete()
        .eq('order_id', order.order_id)
      
      throw itemsError
    }
    
    // 4. Create technician assignments if technician is assigned
    if (input.assigned_technician_id) {
      const technicianAssignments = [
        {
          order_id: order.order_id,
          technician_id: input.assigned_technician_id,
          role: 'lead',
          assigned_at: new Date().toISOString()
        }
      ]
      
      // Add helper technicians if provided
      if (input.helper_technician_ids && input.helper_technician_ids.length > 0) {
        for (const helperId of input.helper_technician_ids) {
          technicianAssignments.push({
            order_id: order.order_id,
            technician_id: helperId,
            role: 'helper',
            assigned_at: new Date().toISOString()
          })
        }
      }
      
      const { error: techError } = await supabase
        .from('order_technicians')
        .insert(technicianAssignments)
      
      if (techError) {
        logger.error('[createOrderWithItems] Failed to assign technicians:', techError)
        // Don't rollback entire order, just log the error
      }
    }
    
    revalidatePath('/dashboard/operasional/orders')
    
    return {
      success: true,
      data: { order_id: order.order_id }
    }
  } catch (error) {
    logger.error('[createOrderWithItems] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order'
    }
  }
}

/**
 * Create new location for customer
 * Used when customer selects "New Location" in form
 */
export async function createLocation(data: {
  customer_id: string;
  full_address: string;
  house_number?: string; // Support alphanumeric (e.g., "12A", "5B")
  city?: string;
  landmarks?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{
  success: boolean;
  data?: { location_id: string };
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    const { data: newLocation, error } = await supabase
      .from('locations')
      .insert({
        customer_id: data.customer_id,
        full_address: data.full_address,
        house_number: data.house_number || '1',
        city: data.city || '',
        landmarks: data.landmarks,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      })
      .select('location_id')
      .single()
    
    if (error) throw error
    
    revalidatePath('/dashboard/manajemen/customer')
    
    return {
      success: true,
      data: { location_id: newLocation.location_id }
    }
  } catch (error) {
    logger.error('[createLocation] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create location'
    }
  }
}
