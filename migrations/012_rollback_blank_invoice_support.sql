-- ============================================
-- ROLLBACK: 012_add_blank_invoice_support.sql
-- ============================================
-- WARNING: This rollback will fail if any rows have:
--   * source = 'BLANK', or
--   * order_id IS NULL, or
--   * customer_id IS NULL, or
--   * service_type / service_name / base_service_price / base_service_total IS NULL
-- Clean up or delete those rows before running this rollback.

-- Drop integrity constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoices_source_integrity;

-- Drop index
DROP INDEX IF EXISTS idx_invoices_source;

-- Drop columns
ALTER TABLE invoices
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS customer_name_override,
  DROP COLUMN IF EXISTS customer_phone_override,
  DROP COLUMN IF EXISTS customer_email_override,
  DROP COLUMN IF EXISTS customer_address_override;

-- Restore NOT NULL constraints
ALTER TABLE invoices
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN customer_id SET NOT NULL,
  ALTER COLUMN service_type SET NOT NULL,
  ALTER COLUMN service_name SET NOT NULL,
  ALTER COLUMN base_service_price SET NOT NULL,
  ALTER COLUMN base_service_total SET NOT NULL;
