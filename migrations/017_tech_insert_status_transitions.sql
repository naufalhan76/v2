-- =============================================================================
-- 017: Technician INSERT policy on order_status_transitions
-- =============================================================================
--
-- The technician transition + report routes write an audit row to
-- order_status_transitions on every state change. RLS was enabled on the
-- table with tech SELECT (tech_read_own) but NO tech INSERT policy — only
-- admins could write. Result: every technician transition threw 42501
-- "new row violates row-level security policy".
--
-- This mirrors the sibling write policies that DO exist:
--   orders_tech_update_own           (FOR UPDATE)
--   service_reports_tech_insert_own  (FOR INSERT)
--
-- A technician may insert a transition row only for an order where they are
-- the lead, matching the same lead-gating used across the technician surface.
-- =============================================================================

CREATE POLICY "order_status_transitions_tech_insert_own"
  ON public.order_status_transitions
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'TECHNICIAN'
    AND EXISTS (
      SELECT 1 FROM public.order_technicians ot
      WHERE ot.order_id = order_status_transitions.order_id
        AND ot.technician_id = current_technician_id()
        AND ot.role = 'lead'
    )
  );
