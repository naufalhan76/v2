-- Add soft-delete column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active orders (most queries filter deleted)
CREATE INDEX IF NOT EXISTS idx_orders_active ON public.orders(status, scheduled_visit_date) WHERE deleted_at IS NULL;

-- Index for finding deleted orders (admin audit)
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NOT NULL;
