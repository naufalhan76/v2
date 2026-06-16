import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical } from '@/lib/order-status'
import { log, normalizeJobOrderItems, first } from './shared'

function decodeOrderId(segments: string[]) {
  try {
    return { orderId: segments.map(decodeURIComponent).join('/') }
  } catch (error) {
    log.error('Invalid encoded technician job id', { segments, error })
    return { error: jsonError('Invalid encoded order id', 400) }
  }
}

export async function handleGetJob(
  request: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId } = authResult
    const resolvedParams = await params
    const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
    const decoded = decodeOrderId(rawId)
    if (decoded.error) return decoded.error
    const orderId = decoded.orderId
    const supabase = await createClient()

    // Verify this technician is assigned to this order
    const { data: assignment, error: assignError } = await supabase
      .from('order_technicians')
      .select('role')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .is('removed_at', null)
      .maybeSingle()

    if (assignError) throw assignError
    if (!assignment) {
      return jsonError('Order not found or not assigned to you', 404)
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        order_id,
        customer_id,
        status,
        scheduled_visit_date,
        description,
        created_at,
        updated_at,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number,
          email
        ),
        order_items (
          order_item_id,
          ac_unit_id,
          location_id,
          unit_type_id,
          capacity_id,
          brand_id,
          service_type_id,
          catalog_id,
          msn_code,
          service_type,
          quantity,
          description,
          estimated_price,
          locations (
            location_id,
            customer_id,
            full_address,
            house_number,
            city
          ),
          unit_types (name),
          capacity_ranges (capacity_label),
          ac_brands (name),
          service_catalog (
            catalog_id,
            msn_code,
            service_name,
            base_price,
            unit_type_id,
            capacity_id,
            service_type_id,
            unit_types (name),
            capacity_ranges (capacity_label)
          ),
          ac_units (
            ac_unit_id,
            location_id,
            brand,
            brand_id,
            model_number,
            serial_number,
            installation_date,
            ac_type,
            unit_type_id,
            capacity_id,
            room_location,
            floor_level,
            position_detail,
            ac_brands (name),
            unit_types (name),
            capacity_ranges (
              capacity_label
            ),
            locations (
              location_id,
              customer_id,
              full_address,
              house_number,
              city
            )
          )
        ),
        order_technicians (
          id,
          technician_id,
          role,
          assigned_at,
          technicians (
            technician_id,
            technician_name,
            contact_number
          )
        )
      `)
      .eq('order_id', orderId)
      .single()

    if (orderError) throw orderError
    if (!order) {
      return jsonError('Order not found', 404)
    }

    const { data: report } = await supabase
      .from('service_reports')
      .select('report_id, submitted_at')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .is('deleted_at', null)
      .maybeSingle()

    return jsonSuccess({
      ...order,
      order_items: normalizeJobOrderItems(order),
      canonical_status: toCanonical(order.status),
      has_report: !!report,
      report_id: report?.report_id ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
