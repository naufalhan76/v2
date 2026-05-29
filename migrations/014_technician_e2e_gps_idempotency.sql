-- =============================================================================
-- 014: Technician E2E — GPS audit, multi-AC payload, idempotency
-- =============================================================================
--
-- Adds the columns needed by the offline-capable technician app:
--
-- 1. order_status_transitions: GPS audit fields. Capture is best-effort —
--    every column is nullable so a denied permission or timeout never blocks
--    a transition.
--
-- 2. service_reports: per-AC report payload (JSONB) so a single submission
--    can carry data for multiple AC units; idempotency_key for safe retries
--    over flaky networks.
--
-- 3. order_status_transitions: idempotency_key for queued transitions sent
--    while offline.
--
-- All ALTERs are IF NOT EXISTS-safe.
-- =============================================================================

-- 1. GPS audit on transitions ------------------------------------------------
ALTER TABLE public.order_status_transitions
  ADD COLUMN IF NOT EXISTS lat          NUMERIC,
  ADD COLUMN IF NOT EXISTS lng          NUMERIC,
  ADD COLUMN IF NOT EXISTS accuracy_m   NUMERIC,
  ADD COLUMN IF NOT EXISTS captured_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_error    TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- A unique partial index lets us dedupe queued transitions per order without
-- forcing every legacy row to carry a key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_status_transitions_idem
  ON public.order_status_transitions (order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Multi-AC payload + idempotency on service reports ------------------------
ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS ac_units         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_reports_idem
  ON public.service_reports (technician_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.service_reports.ac_units IS
  'Array of per-AC report items: {ac_unit_id, brand, capacity_pk, room_location, model_number, serial_number, ac_type, photos_before[], photos_after[], notes, materials_used[], skipped, skip_reason}';

COMMENT ON COLUMN public.order_status_transitions.gps_error IS
  'Reason GPS could not be captured: denied | timeout | unavailable | unsupported. NULL when lat/lng populated.';
