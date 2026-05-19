-- ============================================
-- MIGRATION: Add Blank Invoice Support
-- Version: 012
-- Date: 2026-05-19
-- Description: Allow invoices that are not linked to any order
--   - Make invoices.order_id nullable
--   - Add invoices.source column ('ORDER_LINKED' | 'BLANK')
--   - Add invoices.customer_name_override (snapshot for blank invoices)
--   - Add invoices.customer_phone_override
--   - Add invoices.customer_email_override
--   - Add invoices.customer_address_override
-- Related plan: invoices-blank-revision (Task 3)
-- ============================================

-- Step 1: Drop NOT NULL constraint on invoices.order_id
ALTER TABLE invoices
  ALTER COLUMN order_id DROP NOT NULL;

-- Step 2: Add invoice source column with default 'ORDER_LINKED' (back-compat)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source TEXT
  NOT NULL DEFAULT 'ORDER_LINKED'
  CHECK (source IN ('ORDER_LINKED', 'BLANK'));

-- Step 3: Add manual customer override fields for blank invoices
-- These are only populated when source = 'BLANK' and customer_id is NULL.
-- For ORDER_LINKED invoices, customer info is fetched via customer_id join.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_name_override TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone_override TEXT,
  ADD COLUMN IF NOT EXISTS customer_email_override TEXT,
  ADD COLUMN IF NOT EXISTS customer_address_override TEXT;

-- Step 4: Allow customer_id to be NULL (blank invoices may not link a customer record)
ALTER TABLE invoices
  ALTER COLUMN customer_id DROP NOT NULL;

-- Step 5: Allow service_type / service_name / base_service_price to be NULL for blank invoices
-- (Blank invoices do not have a single "base service" — only line items.)
ALTER TABLE invoices
  ALTER COLUMN service_type DROP NOT NULL,
  ALTER COLUMN service_name DROP NOT NULL,
  ALTER COLUMN base_service_price DROP NOT NULL,
  ALTER COLUMN base_service_total DROP NOT NULL;

-- Step 6: Integrity rule — a blank invoice MUST have a customer name override
--                          and an order-linked invoice MUST have order_id + customer_id
ALTER TABLE invoices
  ADD CONSTRAINT chk_invoices_source_integrity CHECK (
    (source = 'ORDER_LINKED' AND order_id IS NOT NULL AND customer_id IS NOT NULL)
    OR
    (source = 'BLANK' AND customer_name_override IS NOT NULL AND length(trim(customer_name_override)) > 0)
  );

-- Step 7: Index source for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_source ON invoices(source);

-- Documentation
COMMENT ON COLUMN invoices.order_id IS 'Linked order id. NULL when source = BLANK.';
COMMENT ON COLUMN invoices.customer_id IS 'Linked customer id. NULL allowed when source = BLANK and only manual customer info is captured.';
COMMENT ON COLUMN invoices.source IS 'Invoice origin: ORDER_LINKED (created from an order) or BLANK (manual standalone invoice).';
COMMENT ON COLUMN invoices.customer_name_override IS 'Manual customer name for BLANK invoices.';
COMMENT ON COLUMN invoices.customer_phone_override IS 'Manual customer phone for BLANK invoices.';
COMMENT ON COLUMN invoices.customer_email_override IS 'Manual customer email for BLANK invoices.';
COMMENT ON COLUMN invoices.customer_address_override IS 'Manual customer billing address for BLANK invoices.';
