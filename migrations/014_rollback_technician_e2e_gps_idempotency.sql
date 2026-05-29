-- Rollback for 014_technician_e2e_gps_idempotency.sql
DROP INDEX IF EXISTS public.uq_order_status_transitions_idem;
DROP INDEX IF EXISTS public.uq_service_reports_idem;

ALTER TABLE public.order_status_transitions
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS accuracy_m,
  DROP COLUMN IF EXISTS captured_at,
  DROP COLUMN IF EXISTS gps_error,
  DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE public.service_reports
  DROP COLUMN IF EXISTS ac_units,
  DROP COLUMN IF EXISTS idempotency_key;
