'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { 
  CustomerSearchResult, 
  CreateOrderInput, 
  ServicePricing 
} from '@/types/create-order'

/**
 * Search customer by phone number
 * Returns customer with locations and AC units if found
 */
export async function searchCustomerByPhone(phone: string): Promise<{
  success: boolean;
  data?: CustomerSearchResult;
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    // Normalize phone (remove non-numeric except +)
    const normalizedPhone = phone.replace(/[^\d+]/g, '')
    
    // Search customer by phone
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        customer_id,
        customer_name,
        phone_number,
        primary_contact_person,
        email,
        billing_address
      `)
      .eq('phone_number', normalizedPhone)
      .single()
    
    if (customerError) {
      if (customerError.code === 'PGRST116') {
        // No customer found
        return { success: true, data: undefined }
      }
      throw customerError
    }
    
    // Get customer's locations with AC units
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select(`
        location_id,
        building_name,
        floor,
        room_number,
        description,
        ac_units (
          ac_unit_id,
          brand,
          model_number,
          serial_number,
          ac_type,
          capacity_btu,
          status
        )
      `)
      .eq('customer_id', customer.customer_id)
    
    if (locationsError) throw locationsError
    
    return {
      success: true,
      data: {
        ...customer,
        locations: locations || []
      }
    }
  } catch (error) {
    console.error('[searchCustomerByPhone] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search customer'
    }
  }
}

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
        billing_address: data.billing_address || 'TBD' // Fallback if no address provided
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
    console.error('[createCustomer] Error:', error)
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
    const orderStatus = input.assigned_technician_id ? 'ASSIGNED' : 'ACCEPTED'
    
    // Determine order_type (legacy field with FK constraint to service_pricing):
    // - If explicitly provided, use that
    // - If all items have same service_type, use that
    // - If mixed, find most common service type (or first if tied)
    let orderType = input.order_type
    if (!orderType) {
      const serviceTypeCounts = input.items.reduce((acc, item) => {
        acc[item.service_type] = (acc[item.service_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Find the most common service type
      const sortedTypes = Object.entries(serviceTypeCounts).sort((a, b) => b[1] - a[1])
      orderType = sortedTypes[0][0] // Most common (or first if tied)
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
    
    // 2. Create AC units for new units (where ac_unit_id is null)
    const newAcUnits: Array<{
      location_id: string;
      brand: string;
      model_number: string;
      capacity_btu: number | null;
      status: string;
    }> = []
    
    const itemIndexMapping: number[] = [] // Track which item index each AC belongs to

    input.items.forEach((item, index) => {
      if (!item.ac_unit_id && item.new_ac_data) {
        // This is a new AC unit, prepare for insertion
        newAcUnits.push({
          location_id: item.location_id,
          brand: item.new_ac_data.brand,
          model_number: item.new_ac_data.model_number,
          capacity_btu: item.new_ac_data.capacity_btu || null,
          status: 'PENDING' // Waiting for technician to verify
        })
        itemIndexMapping.push(index)
      }
    })

    // Insert new AC units if any
    const createdAcUnitIds: Map<number, string> = new Map()
    
    if (newAcUnits.length > 0) {
      const { data: insertedAcUnits, error: acUnitsError } = await supabase
        .from('ac_units')
        .insert(newAcUnits)
        .select('ac_unit_id')
      
      if (acUnitsError) {
        // Rollback: delete order if AC units failed
        await supabase
          .from('orders')
          .delete()
          .eq('order_id', order.order_id)
        
        throw acUnitsError
      }
      
      // Map created AC unit IDs to their original item indices
      itemIndexMapping.forEach((itemIndex, idx) => {
        if (insertedAcUnits && insertedAcUnits[idx]) {
          createdAcUnitIds.set(itemIndex, insertedAcUnits[idx].ac_unit_id)
        }
      })
    }

    // 3. Create order items (same status as parent order)
    const orderItems = input.items.map((item, index) => ({
      order_id: order.order_id,
      location_id: item.location_id,
      ac_unit_id: item.ac_unit_id || createdAcUnitIds.get(index) || null,
      service_type: item.service_type,
      quantity: item.quantity || 1,
      description: item.description,
      estimated_price: item.estimated_price || 0,
      status: orderStatus // Match parent order status
    }))
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
    
    if (itemsError) {
      // Rollback: delete AC units and order if items failed
      if (createdAcUnitIds.size > 0) {
        await supabase
          .from('ac_units')
          .delete()
          .in('ac_unit_id', Array.from(createdAcUnitIds.values()))
      }
      
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
        console.error('[createOrderWithItems] Failed to assign technicians:', techError)
        // Don't rollback entire order, just log the error
      }
    }
    
    revalidatePath('/dashboard/operasional/orders')
    
    return {
      success: true,
      data: { order_id: order.order_id }
    }
  } catch (error) {
    console.error('[createOrderWithItems] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order'
    }
  }
}

/**
 * Get service pricing for auto-calculation
 * Returns all active services with base prices
 */
export async function getServicePricing(): Promise<{
  success: boolean;
  data?: ServicePricing[];
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('service_pricing')
      .select('pricing_id, service_type, service_name, base_price, description')
      .eq('is_active', true)
      .order('service_type')
    
    if (error) throw error
    
    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('[getServicePricing] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pricing'
    }
  }
}

/**
 * Create new location for customer
 * Used when customer selects "New Location" in form
 */
export async function createLocation(data: {
  customer_id: string;
  building_name: string;
  floor?: number;
  room_number?: string;
  description?: string;
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
        building_name: data.building_name,
        floor: data.floor || 1,
        room_number: data.room_number || '',
        description: data.description
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
    console.error('[createLocation] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create location'
    }
  }
}

/**
 * Get technicians for assignment dropdown
 */
export async function getTechnicians(): Promise<{
  success: boolean;
  data?: Array<{
    technician_id: string;
    full_name: string;
    employee_id: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('technicians')
      .select('technician_id, technician_name, contact_number')
      .order('technician_name')
    
    if (error) throw error
    
    // Map to expected format
    const mapped = data?.map(tech => ({
      technician_id: tech.technician_id,
      full_name: tech.technician_name,
      employee_id: tech.contact_number // Use phone as fallback for employee_id
    })) || []
    
    return {
      success: true,
      data: mapped
    }
  } catch (error) {
    console.error('[getTechnicians] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch technicians'
    }
  }
}
