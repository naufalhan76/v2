-- Rollback for 016_add_transition_audit_fields.sql
DROP INDEX IF EXISTS public.idx_order_transitions_changed_by;
ALTER TABLE public.order_status_transitions
  DROP COLUMN IF EXISTS changed_by,
  DROP COLUMN IF EXISTS changed_at;
