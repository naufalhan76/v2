import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { toCanonical } from '@/lib/order-status'

/**
 * GET /api/technician/jobs/[id]
 * Returns a single job detail for the authenticated technician.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId } = authResult
    const { id: orderId } = await params
    const supabase = await createClient()

    // Verify this technician is assigned to this order
    const { data: assignment, error: assignError } = await supabase
      .from('order_technicians')
      .select('role')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .maybeSingle()

    if (assignError) throw assignError
    if (!assignment) {
      return jsonError('Order not found or not assigned to you', 404)
    }

    // Fetch full order detail
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        order_id,
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
          service_type,
          quantity,
          description,
          estimated_price,
          locations (
            location_id,
            full_address,
            house_number,
            city
          ),
          ac_units (
            ac_unit_id,
            brand,
            model_number,
            serial_number,
            installation_date
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

    // Check if service report already exists
    const { data: report } = await supabase
      .from('service_reports')
      .select('report_id, submitted_at')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .is('deleted_at', null)
      .maybeSingle()

    return jsonSuccess({
      ...order,
      canonical_status: toCanonical(order.status),
      has_report: !!report,
      report_id: report?.report_id ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
