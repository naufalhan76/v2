import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../../helpers'
import { toCanonical } from '@/lib/order-status'
import {
  TechnicianReportSchema,
  type AcUnitReportItem,
} from '@/app/api/schemas/technician'

/**
 * POST /api/technician/jobs/[id]/report
 *
 * Submit a service report for a completed job.
 *
 * Wire format: see src/app/api/schemas/technician.ts. The schema accepts an
 * optional `ac_units` array so a single report can carry per-AC data
 * (photos, notes, materials) for orders that touch multiple units. Aggregate
 * fields (`photos_before`, `photos_after`, `materials`, `actual_total_price`)
 * remain authoritative for invoice math; `ac_units` is the audit detail.
 *
 * Idempotency: a `(technician_id, idempotency_key)` partial unique index
 * collapses retries from the offline sync layer to a single row. A second
 * call with the same key returns the original response.
 *
 * On success:
 *   1. inserts service_reports (with idempotency_key + ac_units JSON)
 *   2. upserts each per-AC payload into ac_units (where id provided)
 *   3. propagates next_service_recommendation_date to ac_units
 *   4. transitions order to COMPLETED
 *   5. logs the COMPLETED transition
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

    const parsed = TechnicianReportSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return jsonError(
        `Validation: ${firstIssue.path.join('.')} - ${firstIssue.message}`,
        400
      )
    }

    const reportData = parsed.data
    const supabase = await createClient()

    // P1 fix: lead-assignment check moved ABOVE idempotency check for
    // consistency and defense-in-depth — per oracle review
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

    // -------------------------------------------------------------------------
    // Idempotency replay — same key from same technician returns the original
    // report id without side effects. This is the offline retry path.
    // -------------------------------------------------------------------------
    const { data: idemMatch } = await supabase
      .from('service_reports')
      .select('report_id, order_id')
      .eq('technician_id', technicianId)
      .eq('idempotency_key', reportData.idempotency_key)
      .is('deleted_at', null)
      .maybeSingle()

    if (idemMatch) {
      return jsonSuccess({
        report_id: idemMatch.report_id,
        order_status: 'COMPLETED',
        idempotent_replay: true,
      })
    }

    // Verify order is IN_PROGRESS
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status, location_id')
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

    // Surface duplicate-without-key as a 409 (different from idempotent
    // replay above — this is a non-retry second submission).
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

    // -------------------------------------------------------------------------
    // Per-AC upsert: for items with ac_unit_id, sync any technician-edited
    // fields (brand, serial, etc) back to ac_units. New on-site units (no
    // ac_unit_id) are not auto-created here — ac_units uses a TEXT PK with a
    // generated default and we want admin to confirm new units. The payload
    // is still stored on service_reports.ac_units for audit.
    // -------------------------------------------------------------------------
    const acUnits: AcUnitReportItem[] = reportData.ac_units ?? []

    // P1 fix: parallelize per-AC upsert per oracle F2
    await Promise.all(acUnits.map(async (item) => {
      if (!item.ac_unit_id || item.skipped) return
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (item.brand) updates.brand = item.brand
      if (item.model_number) updates.model_number = item.model_number
      if (item.serial_number) updates.serial_number = item.serial_number
      if (item.ac_type) updates.ac_type = item.ac_type
      if (item.capacity_btu) updates.capacity_btu = item.capacity_btu

      // Only touch ac_units when there is something to update beyond the
      // timestamp. Avoids meaningless writes.
      if (Object.keys(updates).length > 1) {
        const { error: acErr } = await supabase
          .from('ac_units')
          .update(updates)
          .eq('ac_unit_id', item.ac_unit_id)
        if (acErr) throw acErr
      }
    }))

    // -------------------------------------------------------------------------
    // Insert service_reports row.
    // P1 fix: catch unique constraint violation (23505) on idempotency_key so
    // concurrent retries get an idempotent 200 instead of a 500 — per oracle review
    // -------------------------------------------------------------------------
    const { data: report, error: reportError } = await supabase
      .from('service_reports')
      .insert({
        order_id: orderId,
        technician_id: technicianId,
        idempotency_key: reportData.idempotency_key,
        photos_before: reportData.photos_before,
        photos_after: reportData.photos_after,
        materials: reportData.materials,
        ac_units: acUnits,
        actual_total_price: reportData.actual_total_price,
        customer_signature_url: reportData.customer_signature_url,
        customer_name_signed: reportData.customer_name_signed,
        notes: reportData.notes,
        work_started_at: reportData.work_started_at,
        work_completed_at:
          reportData.work_completed_at || new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        next_service_recommendation_date:
          reportData.next_service_recommendation_date || null,
        next_service_recommendation_notes:
          reportData.next_service_recommendation_notes || null,
      })
      .select('report_id')
      .single()

    if (reportError) {
      if (
        reportError.code === '23505' ||
        reportError.message?.includes('duplicate key')
      ) {
        // Race: a concurrent request already committed this report row.
        // Fetch the winning row and return it as an idempotent replay.
        // Do NOT proceed with the COMPLETED transition — it already ran.
        const { data: racedReport } = await supabase
          .from('service_reports')
          .select('report_id')
          .eq('technician_id', technicianId)
          .eq('idempotency_key', reportData.idempotency_key)
          .is('deleted_at', null)
          .maybeSingle()

        return jsonSuccess({
          report_id: racedReport?.report_id ?? null,
          order_status: 'COMPLETED',
          idempotent_replay: true,
        })
      }
      throw reportError
    }

    // -------------------------------------------------------------------------
    // Propagate next_service_recommendation_date to all ac_units linked to
    // this order so the reminder system picks them up.
    // Units marked skipped in the payload are excluded — their service date
    // should not be reset since the technician did not service them.
    // -------------------------------------------------------------------------
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

      const skippedAcIds = new Set(
        (reportData.ac_units ?? [])
          .filter((a) => a.skipped === true && a.ac_unit_id)
          .map((a) => a.ac_unit_id as string)
      )

      const propagateIds = acUnitIds.filter((id) => !skippedAcIds.has(id))

      if (propagateIds.length > 0) {
        const { error: acUpdateError } = await supabase
          .from('ac_units')
          .update({
            next_service_due_date: reportData.next_service_recommendation_date,
            updated_at: new Date().toISOString(),
          })
          .in('ac_unit_id', propagateIds)

        if (acUpdateError) throw acUpdateError
      }
    }

    // Transition order to COMPLETED
    // P1 fix: optimistic lock — TOCTOU per oracle F2
    const { data: completedRow } = await supabase
      .from('orders')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('status', order.status)
      .select('status')
      .maybeSingle()

    if (!completedRow) {
      const { data: reread } = await supabase
        .from('orders')
        .select('status')
        .eq('order_id', orderId)
        .single()
      if (reread?.status !== 'COMPLETED') {
        return jsonError(
          'Order status changed concurrently — report saved but order state inconsistent. Contact admin.',
          409
        )
      }
      // else: someone else already marked it COMPLETED; treat as success.
    }

    // Log the COMPLETED transition
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
