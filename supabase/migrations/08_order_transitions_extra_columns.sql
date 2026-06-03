-- Add missing columns to order_status_transitions
-- Required by POST /api/technician/jobs/[id]/transition
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS gps_error TEXT;
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS arrival_photos TEXT[];

-- Idempotency dedup index for transitions
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_transitions_idempotency
  ON public.order_status_transitions (order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Rename/add changed_at for consistency
ALTER TABLE public.order_status_transitions ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT NOW();

-- Fix technician_id column type in service_reports to TEXT to match technicians.technician_id (which is TEXT)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.service_reports ALTER COLUMN technician_id TYPE TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      -- If foreign key constraint prevents it, do nothing or let it be handled manually
      NULL;
  END;
END$$;

-- Add idempotency_key to service_reports
ALTER TABLE public.service_reports ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index for service_reports idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_reports_idempotency
  ON public.service_reports (order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
