import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../helpers'
import { toCanonical } from '@/lib/order-status'

/**
 * GET /api/technician/history
 * Returns past jobs for the authenticated technician (paginated).
 * Query params: ?page=1&limit=10&status=COMPLETED,CANCELLED
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId } = authResult
    const supabase = await createClient()

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
    const statusFilter = searchParams.get('status') // comma-separated
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Get all order IDs assigned to this technician
    const { data: assignments, error: assignError } = await supabase
      .from('order_technicians')
      .select('order_id')
      .eq('technician_id', technicianId)
      .is('removed_at', null)

    if (assignError) throw assignError
    if (!assignments || assignments.length === 0) {
      return jsonSuccess([])
    }

    const orderIds = assignments.map((a) => a.order_id)

    // Build query for historical orders
    let query = supabase
      .from('orders')
      .select(
        `
        order_id,
        status,
        scheduled_visit_date,
        created_at,
        updated_at,
        customers (
          customer_id,
          customer_name
        ),
        order_items (
          service_type,
          estimated_price
        ),
        service_reports (
          report_id,
          actual_total_price,
          submitted_at
        )
      `,
        { count: 'exact' }
      )
      .in('order_id', orderIds)
      .is('deleted_at', null)
      .order('scheduled_visit_date', { ascending: false })
      .range(from, to)

    // Apply status filter
    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.trim())
      query = query.in('status', statuses)
    } else {
      // Default: show completed, paid, invoiced, cancelled (not active ones)
      query = query.in('status', [
        'COMPLETED',
        'INVOICED',
        'PAID',
        'CANCELLED',
      ])
    }

    const { data: orders, error: orderError, count } = await query

    if (orderError) throw orderError

    // Map canonical statuses
    const mapped = (orders || []).map((order) => ({
      ...order,
      canonical_status: toCanonical(order.status),
    }))

    return jsonSuccess(mapped, 200, {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
