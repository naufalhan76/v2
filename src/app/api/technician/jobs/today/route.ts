import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { toCanonical } from '@/lib/order-status'

/**
 * GET /api/technician/jobs/today
 * Returns today's assigned jobs for the authenticated technician.
 * Includes jobs in states: ASSIGNED, EN_ROUTE, IN_PROGRESS
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId } = authResult
    const supabase = await createClient()

    // Use client-supplied date (YYYY-MM-DD) to avoid UTC/local mismatch around midnight.
    // Falls back to server UTC date if not provided.
    const dateParam = request.nextUrl.searchParams.get('date')
    const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10)

    // Find orders assigned to this technician for today
    const { data: assignments, error: assignError } = await supabase
      .from('order_technicians')
      .select('order_id')
      .eq('technician_id', technicianId)
      .eq('role', 'lead')

    if (assignError) throw assignError

    if (!assignments || assignments.length === 0) {
      return jsonSuccess([])
    }

    const orderIds = assignments.map((a) => a.order_id)

    // Fetch orders with details
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        order_id,
        status,
        scheduled_visit_date,
        notes,
        created_at,
        customers (
          customer_id,
          customer_name,
          primary_contact_person,
          phone_number
        ),
        order_items (
          order_item_id,
          service_type,
          quantity,
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
            serial_number
          )
        )
      `)
      .in('order_id', orderIds)
      .eq('scheduled_visit_date', dateStr)
      .in('status', ['ASSIGNED', 'EN_ROUTE', 'EN ROUTE', 'IN_PROGRESS', 'ARRIVED'])
      .order('scheduled_visit_date', { ascending: true })

    if (orderError) throw orderError

    // Map to canonical statuses for the client
    const mapped = (orders || []).map((order) => ({
      ...order,
      canonical_status: toCanonical(order.status),
    }))

    return jsonSuccess(mapped)
  } catch (error) {
    return handleApiError(error)
  }
}
