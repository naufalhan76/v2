-- =============================================================================
-- 016: Audit columns on order_status_transitions
-- =============================================================================
--
-- Adds changed_by + changed_at to support the transition audit trail.
-- The technician transition route and report route both write these fields
-- on every state change, but they were never present in the base schema.
--
-- Both columns are nullable so legacy transitions remain valid.
-- =============================================================================

ALTER TABLE public.order_status_transitions
  ADD COLUMN IF NOT EXISTS changed_by  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS changed_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_transitions_changed_by
  ON public.order_status_transitions (changed_by)
  WHERE changed_by IS NOT NULL;

COMMENT ON COLUMN public.order_status_transitions.changed_by IS
  'auth.users.id of the actor who triggered the transition. NULL for system events.';
COMMENT ON COLUMN public.order_status_transitions.changed_at IS
  'Wall-clock timestamp captured at transition time. transition_date is the DB-side default; this is the route-supplied value.';
