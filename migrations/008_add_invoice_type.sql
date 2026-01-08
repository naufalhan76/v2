-- ============================================
-- MIGRATION: Add invoice_type column
-- Version: 008
-- Date: 2026-01-05
-- Description: Add invoice_type column to support Proforma invoices
-- ============================================

-- Add invoice_type column to invoices table
ALTER TABLE invoices
ADD COLUMN invoice_type TEXT DEFAULT 'FINAL' CHECK (invoice_type IN ('PROFORMA', 'FINAL'));

-- Create index for faster filtering by invoice type
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);

-- Create combined index for common queries (type + status)
CREATE INDEX IF NOT EXISTS idx_invoices_type_status ON invoices(invoice_type, status);

-- Add comment for documentation
COMMENT ON COLUMN invoices.invoice_type IS 'Invoice type: PROFORMA (can be created from ASSIGNED order) or FINAL (from DONE order)';

-- Verify all existing invoices are set to FINAL
UPDATE invoices SET invoice_type = 'FINAL' WHERE invoice_type IS NULL;

-- Make column NOT NULL after ensuring all records have values
ALTER TABLE invoices
ALTER COLUMN invoice_type SET NOT NULL;
