import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical } from '@/lib/order-status'
import { z } from 'zod'

const materialSchema = z.object({
  addon_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Nama material wajib diisi'),
  qty: z.number().min(1, 'Qty minimal 1'),
  unit_price: z.number().min(0, 'Harga tidak boleh negatif'),
  total: z.number().min(0),
})

const reportSchema = z.object({
  photos_before: z.array(z.string().url()).min(1, 'Minimal 1 foto sebelum'),
  photos_after: z.array(z.string().url()).min(1, 'Minimal 1 foto sesudah'),
  materials: z.array(materialSchema).default([]),
  actual_total_price: z.number().min(0, 'Harga aktual wajib diisi'),
  customer_signature_url: z.string().url('URL signature tidak valid'),
  customer_name_signed: z.string().min(1, 'Nama penandatangan wajib diisi'),
  notes: z.string().optional().default(''),
  work_started_at: z.string().datetime().optional().nullable(),
  work_completed_at: z.string().datetime().optional().nullable(),
  next_service_recommendation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional()
    .nullable(),
  next_service_recommendation_notes: z.string().optional().nullable(),
})

/**
 * POST /api/technician/jobs/[id]/report
 * Submit a service report for a completed job.
 * Automatically transitions order to COMPLETED.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId, userId } = authResult
    const { id: orderId } = await params
    const body = await request.json()

    // Validate input
    const parsed = reportSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return jsonError(`Validation: ${firstIssue.path.join('.')} - ${firstIssue.message}`, 400)
    }

    const reportData = parsed.data
    const supabase = await createClient()

    // Verify assignment (lead only)
    const { data: assignment, error: assignError } = await supabase
      .from('order_technicians')
      .select('role')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .eq('role', 'lead')
      .maybeSingle()

    if (assignError) throw assignError
    if (!assignment) {
      return jsonError('Not assigned as lead technician for this order', 403)
    }

    // Verify order is IN_PROGRESS
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .single()

    if (orderError) throw orderError
    const canonical = toCanonical(order.status)

    if (canonical !== 'IN_PROGRESS') {
      return jsonError(
        `Cannot submit report: order status is ${canonical}, expected IN_PROGRESS`,
        422
      )
    }

    // Check for existing report (prevent duplicates)
    const { data: existingReport } = await supabase
      .from('service_reports')
      .select('report_id')
      .eq('order_id', orderId)
      .eq('technician_id', technicianId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingReport) {
      return jsonError('Service report already submitted for this order', 409)
    }

    // Insert service report
    const { data: report, error: reportError } = await supabase
      .from('service_reports')
      .insert({
        order_id: orderId,
        technician_id: technicianId,
        photos_before: reportData.photos_before,
        photos_after: reportData.photos_after,
        materials: reportData.materials,
        actual_total_price: reportData.actual_total_price,
        customer_signature_url: reportData.customer_signature_url,
        customer_name_signed: reportData.customer_name_signed,
        notes: reportData.notes,
        work_started_at: reportData.work_started_at,
        work_completed_at: reportData.work_completed_at || new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        next_service_recommendation_date: reportData.next_service_recommendation_date || null,
        next_service_recommendation_notes: reportData.next_service_recommendation_notes || null,
      })
      .select('report_id')
      .single()

    if (reportError) throw reportError

    // If technician recommended a next-service date, propagate it to the
    // ac_units linked to this order's order_items so the reminder system
    // can pick them up via ac_units.next_service_due_date.
    if (reportData.next_service_recommendation_date) {
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('ac_unit_id')
        .eq('order_id', orderId)

      if (itemsError) throw itemsError

      const acUnitIds = Array.from(
        new Set(
          (orderItems ?? [])
            .map((it) => it.ac_unit_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      if (acUnitIds.length > 0) {
        const { error: acUpdateError } = await supabase
          .from('ac_units')
          .update({
            next_service_due_date: reportData.next_service_recommendation_date,
            updated_at: new Date().toISOString(),
          })
          .in('ac_unit_id', acUnitIds)

        if (acUpdateError) throw acUpdateError
      }
    }

    // Transition order to COMPLETED
    const { error: transitionError } = await supabase
      .from('orders')
      .update({
        status: 'COMPLETED',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    if (transitionError) throw transitionError

    // Log the transition
    await supabase.from('order_status_transitions').insert({
      order_id: orderId,
      from_status: order.status,
      to_status: 'COMPLETED',
      changed_by: userId,
      changed_at: new Date().toISOString(),
      notes: 'Service report submitted by technician',
    })

    return jsonSuccess(
      { report_id: report.report_id, order_status: 'COMPLETED' },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
