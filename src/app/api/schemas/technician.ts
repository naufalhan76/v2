/**
 * Technician E2E shared zod schemas.
 *
 * Single source of truth for the wire format used by:
 *   - POST /api/technician/jobs/[id]/transition  (TechnicianTransitionSchema)
 *   - POST /api/technician/jobs/[id]/report      (TechnicianReportSchema)
 *
 * The offline sync layer (src/lib/offline/*) imports these types directly so
 * a queued payload in IndexedDB cannot drift from what the server accepts.
 *
 * All payloads carry an `idempotency_key` so retries over flaky networks
 * collapse to a single row server-side.
 */

import { z } from 'zod'

// ============================================================================
// GPS — best-effort capture, never blocks a transition
// ============================================================================

export const GpsCaptureSchema = z
  .object({
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    accuracy_m: z.number().nonnegative().optional().nullable(),
    captured_at: z.string().datetime().optional().nullable(),
    gps_error: z
      .enum(['denied', 'timeout', 'unavailable', 'unsupported'])
      .optional()
      .nullable(),
  })
  .refine(
    (v) => {
      // Rules:
      //  Case A: server got coords → no error.
      //  Case B: server got an error reason → no coords.
      //  Case C: nothing sent at all → backward-compat for legacy clients.
      return (
        (v.lat != null && v.lng != null && !v.gps_error) ||
        (v.lat == null && v.lng == null && !!v.gps_error) ||
        (v.lat == null && v.lng == null && !v.gps_error)
      )
    },
    { message: 'gps: provide either coords or gps_error, not both' }
  )

export type GpsCapture = z.infer<typeof GpsCaptureSchema>

// ============================================================================
// MATERIAL ITEM — same shape as src/components/technician/material-input.tsx
// ============================================================================

export const MaterialItemSchema = z.object({
  addon_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Nama material wajib diisi'),
  qty: z.number().min(1, 'Qty minimal 1'),
  unit_price: z.number().min(0, 'Harga tidak boleh negatif'),
  total: z.number().min(0),
  // NEW fields for manual addon request
  category: z.string().optional().nullable(),          // PARTS, FREON, etc.
  unit_of_measure: z.string().optional().nullable(),    // pcs, kg, etc.
  description: z.string().optional().nullable(),
  is_manual: z.boolean().optional().default(false),     // Flag for admin review
})

export type MaterialItem = z.infer<typeof MaterialItemSchema>

// ============================================================================
// PER-AC REPORT ITEM
// ============================================================================
//
// Either references an existing AC via ac_unit_id (the common path — order
// items already point at the AC unit), OR carries a full create payload for
// a unit the technician discovered on-site. The route handler resolves this
// into upserts against ac_units.
// ============================================================================

const AcUnitNewFieldsSchema = z.object({
  brand: z.string().min(1).optional().nullable(),
  brand_id: z.string().uuid().optional().nullable(),        // NEW: FK to ac_brands
  unit_type_id: z.string().uuid().optional().nullable(),     // NEW: FK to unit_types
  capacity_id: z.string().uuid().optional().nullable(),      // NEW: FK to capacity_ranges  
  capacity_label: z.string().optional().nullable(),          // NEW: display label (e.g. "0.5-1.5 HP")
  room_location: z.string().optional().nullable(),
  floor_level: z.string().optional().nullable(),             // NEW
  position_detail: z.string().optional().nullable(),         // NEW
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  ac_type: z.string().optional().nullable(),                 // Keep for backward compat
  capacity_pk: z.string().optional().nullable(),             // Keep for backward compat
  capacity_btu: z.number().int().positive().optional().nullable(),
})

export const AcUnitReportItemSchema = AcUnitNewFieldsSchema.extend({
  order_item_id: z.string().uuid().optional().nullable(),
  service_type_id: z.string().uuid().optional().nullable(),
  catalog_id: z.string().uuid().optional().nullable(),
  msn_code: z.string().optional().nullable(),
  ac_unit_id: z.string().optional().nullable(),
  /** True when the technician marks this unit as not serviced for this visit. */
  skipped: z.boolean().optional().default(false),
  skip_reason: z.string().optional().nullable(),
  photos_before: z.array(z.string()).default([]),
  photos_after: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  materials_used: z.array(MaterialItemSchema).default([]),
}).refine(
  (v) => {
    if (v.skipped) return !!v.skip_reason
    return !!v.ac_unit_id || (!!v.brand_id && !!v.unit_type_id && !!v.capacity_id && !!v.room_location)
  },
  {
    message:
      'ac_units[i]: provide ac_unit_id for existing unit, or brand_id, unit_type_id, capacity_id, and room_location for a new on-site unit; skipped units must include skip_reason',
  }
)

export type AcUnitReportItem = z.infer<typeof AcUnitReportItemSchema>

// ============================================================================
// TRANSITION PAYLOAD
// ============================================================================

export const TechnicianTransitionSchema = z.object({
  to_status: z.enum(['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED']),
  /** UUID v4 — required so retries dedupe server-side. */
  idempotency_key: z.string().uuid().optional().nullable(),
  gps: GpsCaptureSchema.optional().nullable(),
  /** Arrival photos for EN_ROUTE → IN_PROGRESS. Min 1, max 3. */
  arrival_photos: z.array(z.string()).min(1).max(3).optional(),
})

export type TechnicianTransitionPayload = z.infer<
  typeof TechnicianTransitionSchema
>

// ============================================================================
// FULL REPORT PAYLOAD
// ============================================================================

export const TechnicianReportSchema = z.object({
  /** UUID v4 — required for safe retries. */
  idempotency_key: z.string().uuid(),

  // Aggregate fields (kept for backward compat with existing service_reports
  // columns). Per-AC photos in ac_units[] are the source of truth — these
  // top-level arrays are only populated when there are job-level photos
  // (signature, etc). The sync manager patches them after upload.
  photos_before: z.array(z.string()).default([]),
  photos_after: z.array(z.string()).default([]),
  materials: z.array(MaterialItemSchema).default([]),
  actual_total_price: z.number().min(0, 'Harga aktual wajib diisi').optional().default(0),
  customer_signature_url: z.string().min(1, 'Signature path wajib diisi'),
  customer_name_signed: z.string().min(1, 'Nama penandatangan wajib diisi'),
  notes: z.string().optional().default(''),
  work_started_at: z.string().datetime().optional().nullable(),
  work_completed_at: z.string().datetime().optional().nullable(),
  work_duration_minutes: z.number().int().optional(),
  next_service_recommendation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional()
    .nullable(),
  next_service_recommendation_notes: z.string().optional().nullable(),

  // New: per-AC payload. Optional during rollout — old clients submitting
  // only the aggregate fields above still validate. New clients send both.
  ac_units: z.array(AcUnitReportItemSchema).optional().default([]),
})

export type TechnicianReportPayload = z.infer<typeof TechnicianReportSchema>

export function normalizeTechnicianReportPayload(
  payload: TechnicianReportPayload
): TechnicianReportPayload {
  return {
    ...payload,
    photos_before: payload.photos_before ?? [],
    photos_after: payload.photos_after ?? [],
    materials: payload.materials ?? [],
    actual_total_price: payload.actual_total_price ?? 0,
    work_started_at: payload.work_started_at ?? null,
    work_completed_at: payload.work_completed_at ?? null,
    ac_units: (payload.ac_units ?? []).map((unit) => ({
      ...unit,
      photos_before: unit.photos_before ?? [],
      photos_after: unit.photos_after ?? [],
      materials_used: unit.materials_used ?? [],
    })),
  }
}
