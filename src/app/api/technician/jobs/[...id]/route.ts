import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
import { authenticateTechnician, isTechnicianContext } from '../../helpers'
import { toCanonical, canTransition, type OrderStatus } from '@/lib/order-status'
import { TechnicianTransitionSchema, TechnicianReportSchema } from '@/app/api/schemas/technician'
import { computeWorkDurationMinutes } from '@/lib/offline/time'

type MaybeArray<T> = T | T[] | null | undefined

type LookupName = { name?: string | null } | null
type CapacityRange = { capacity_label?: string | null } | null
type OrderLocation = {
  location_id?: string | null
  customer_id?: string | null
  full_address?: string | null
  house_number?: string | null
  city?: string | null
} | null
type AcUnitForJob = {
  ac_unit_id?: string | null
  customer_id?: string | null
  location_id?: string | null
  brand?: string | null
  brand_id?: string | null
  model_number?: string | null
  serial_number?: string | null
  installation_date?: string | null
  ac_type?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  room_location?: string | null
  floor_level?: string | null
  position_detail?: string | null
  ac_brands?: MaybeArray<LookupName>
  unit_types?: MaybeArray<LookupName>
  capacity_ranges?: MaybeArray<CapacityRange>
  locations?: MaybeArray<OrderLocation>
} | null
type OrderItemForJob = {
  order_item_id?: string | null
  ac_unit_id?: string | null
  location_id?: string | null
  unit_type_id?: string | null
  capacity_id?: string | null
  brand_id?: string | null
  service_type_id?: string | null
  catalog_id?: string | null
  msn_code?: string | null
  service_type?: string | null
  quantity?: number | null
  description?: string | null
  estimated_price?: number | null
  locations?: MaybeArray<OrderLocation>
  ac_units?: MaybeArray<AcUnitForJob>
  unit_types?: MaybeArray<LookupName>
  capacity_ranges?: MaybeArray<CapacityRange>
  ac_brands?: MaybeArray<LookupName>
  service_catalog?: MaybeArray<{
    catalog_id?: string | null
    msn_code?: string | null
    service_name?: string | null
    base_price?: number | null
    unit_type_id?: string | null
    capacity_id?: string | null
    service_type_id?: string | null
    unit_types?: MaybeArray<LookupName>
    capacity_ranges?: MaybeArray<CapacityRange>
  } | null>
}
type OrderForJob = {
  customer_id?: string | null
  order_items?: OrderItemForJob[] | null
}

function first<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeJobOrderItems(order: OrderForJob) {
  const orderItems = Array.isArray(order.order_items) ? order.order_items : []

  return orderItems.map((item) => {
    const location = first(item.locations)
    const acUnit = first(item.ac_units)
    const catalog = first(item.service_catalog)

    if (item.ac_unit_id && !acUnit?.ac_unit_id) {
      throw new Error(`AC unit ${item.ac_unit_id} is not accessible for order item ${item.order_item_id}`)
    }

    if (acUnit?.customer_id && order.customer_id && acUnit.customer_id !== order.customer_id) {
      throw new Error(`AC unit ${acUnit.ac_unit_id} belongs to a different customer`)
    }

    if (acUnit?.location_id && item.location_id && acUnit.location_id !== item.location_id) {
      throw new Error(`AC unit ${acUnit.ac_unit_id} belongs to a different location`)
    }

    const acLocation = first(acUnit?.locations)
    const brandName = first(acUnit?.ac_brands)?.name ?? acUnit?.brand ?? null
    const unitTypeName = first(acUnit?.unit_types)?.name ?? acUnit?.ac_type ?? null
    const capacityLabel = first(acUnit?.capacity_ranges)?.capacity_label ?? null

    return {
      ...item,
      ac_unit_id: item.ac_unit_id ?? null,
      locations: location,
      service_catalog: catalog,
      unit_type_name: first(item.unit_types)?.name ?? first(catalog?.unit_types)?.name ?? null,
      capacity_label: first(item.capacity_ranges)?.capacity_label ?? first(catalog?.capacity_ranges)?.capacity_label ?? null,
      brand: first(item.ac_brands)?.name ?? null,
      ac_units: item.ac_unit_id
        ? {
            ...acUnit,
            ac_unit_id: acUnit?.ac_unit_id ?? item.ac_unit_id,
            brand_id: acUnit?.brand_id ?? null,
            brand: brandName,
            unit_type_id: acUnit?.unit_type_id ?? null,
            unit_type_name: unitTypeName,
            ac_type: acUnit?.ac_type ?? unitTypeName,
            capacity_id: acUnit?.capacity_id ?? null,
            capacity_label: capacityLabel,
            capacity_ranges: { capacity_label: capacityLabel },
            location_id: acUnit?.location_id ?? item.location_id ?? null,
            location: acLocation ?? location,
          }
        : null,
    }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId } = authResult
    const resolvedParams = await params
    const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
    const orderId = rawId.map(decodeURIComponent).join('/')
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  try {
    const authResult = await authenticateTechnician(request)
    if (!isTechnicianContext(authResult)) return authResult

    const { technicianId, userId } = authResult
    const resolvedParams = await params
    const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id]
    
    const lastSegment = rawId[rawId.length - 1]
    let action: 'transition' | 'report' | null = null
    let idSegments = rawId

    if (lastSegment === 'transition' || lastSegment === 'report') {
      action = lastSegment as 'transition' | 'report'
      idSegments = rawId.slice(0, -1)
    }

    const orderId = idSegments.map(decodeURIComponent).join('/')
    const body = await request.json()
    const supabase = await createClient()

    if (action === 'transition') {
      const parsed = TechnicianTransitionSchema.safeParse(body)
      if (!parsed.success) {
        return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 400)
      }

      const { to_status, idempotency_key, gps, arrival_photos } = parsed.data

      // Arrival photos required for EN_ROUTE → IN_PROGRESS transition
      if (to_status === 'IN_PROGRESS' && (!arrival_photos || arrival_photos.length < 1)) {
        return jsonError('arrival_photos required for Mulai Kerja (min 1, max 3)', 400)
      }

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

      if (idempotency_key) {
        const { data: existing } = await supabase
          .from('order_status_transitions')
          .select('to_status')
          .eq('order_id', orderId)
          .eq('idempotency_key', idempotency_key)
          .maybeSingle()

        if (existing) {
          return jsonSuccess({
            order_id: orderId,
            new_status: existing.to_status,
            idempotent_replay: true,
          })
        }
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('status')
        .eq('order_id', orderId)
        .single()

      if (orderError) throw orderError
      if (!order) {
        return jsonError('Order not found', 404)
      }

      const currentCanonical = toCanonical(order.status)

      if (currentCanonical === to_status) {
        return jsonSuccess({
          order_id: orderId,
          previous_status: currentCanonical,
          new_status: to_status,
          idempotent_replay: true,
        })
      }

      if (!canTransition(order.status, to_status as OrderStatus, 'TECHNICIAN')) {
        return jsonError(
          `Invalid transition: cannot move from ${currentCanonical} to ${to_status}`,
          422
        )
      }

      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({
          status: to_status,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('status', order.status)
        .select('status')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updated) {
        return jsonError('Order status changed concurrently. Refresh and retry.', 409)
      }

      const { data: insertedTransition, error: insertError } = await supabase
        .from('order_status_transitions')
        .insert({
          order_id: orderId,
          from_status: order.status,
          to_status,
          changed_by: userId,
          changed_at: new Date().toISOString(),
          notes: `Technician transition: ${currentCanonical} → ${to_status}`,
          idempotency_key: idempotency_key ?? null,
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
          accuracy_m: gps?.accuracy_m ?? null,
          captured_at: gps?.captured_at ?? null,
          gps_error: gps?.gps_error ?? null,
          arrival_photos: arrival_photos ?? null,
        })
        .select('to_status')
        .single()

      if (insertError) {
        if (
          insertError.code === '23505' ||
          insertError.message?.includes('duplicate key')
        ) {
          const { data: racedRow } = await supabase
            .from('order_status_transitions')
            .select('to_status')
            .eq('order_id', orderId)
            .eq('idempotency_key', idempotency_key)
            .maybeSingle()

          return jsonSuccess({
            order_id: orderId,
            new_status: racedRow?.to_status ?? to_status,
            idempotent_replay: true,
          })
        }
        throw insertError
      }

      return jsonSuccess({
        order_id: orderId,
        previous_status: currentCanonical,
        new_status: insertedTransition?.to_status ?? to_status,
      })
    }

    if (action === 'report') {
      const parsed = TechnicianReportSchema.safeParse(body)
      if (!parsed.success) {
        return jsonError(`Invalid input: ${parsed.error.issues[0].message}`, 400)
      }

      const payload = parsed.data
      const rpcPayload =
        payload.work_started_at && payload.work_completed_at
          ? {
              ...payload,
              work_duration_minutes: computeWorkDurationMinutes(
                payload.work_started_at,
                payload.work_completed_at
              ),
            }
          : payload

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

      const { data: existingReport } = await supabase
        .from('service_reports')
        .select('report_id')
        .eq('order_id', orderId)
        .eq('idempotency_key', payload.idempotency_key)
        .maybeSingle()

      if (existingReport) {
        return jsonSuccess({
          report_id: existingReport.report_id,
          idempotent_replay: true,
        })
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('status')
        .eq('order_id', orderId)
        .single()

      if (orderError) throw orderError
      
      const currentCanonical = toCanonical(order.status)
      if (currentCanonical === 'COMPLETED' || currentCanonical === 'INVOICED' || currentCanonical === 'PAID') {
        const { data: completedReport } = await supabase
          .from('service_reports')
          .select('report_id')
          .eq('order_id', orderId)
          .maybeSingle()
          
        if (completedReport) {
          return jsonSuccess({
             report_id: completedReport.report_id,
             idempotent_replay: true,
             message: 'Order already completed and reported'
          })
        }
      }

      if (currentCanonical !== 'IN_PROGRESS') {
        return jsonError(`Cannot submit report when order is ${currentCanonical}`, 422)
      }

      const { data: result, error: rpcError } = await supabase.rpc('technician_submit_report_v2', {
        p_order_id: orderId,
        p_technician_id: technicianId,
        p_payload: rpcPayload,
        p_work_duration_minutes: rpcPayload.work_duration_minutes ?? null,
      })

      if (rpcError) {
        if (rpcError.code === '23505' || rpcError.message?.includes('duplicate key')) {
          const { data: racedReport } = await supabase
            .from('service_reports')
            .select('report_id')
            .eq('order_id', orderId)
            .eq('idempotency_key', payload.idempotency_key)
            .maybeSingle()

          return jsonSuccess({
            report_id: racedReport?.report_id,
            idempotent_replay: true,
          })
        }
        
        if (rpcError.code === 'P0001') {
          return jsonError(rpcError.message, 422)
        }
        
        throw rpcError
      }

      return jsonSuccess({
        report_id: result,
        status: 'COMPLETED'
      })
    }

    return jsonError('Invalid action', 400)
  } catch (error) {
    return handleApiError(error)
  }
}
