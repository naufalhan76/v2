-- ============================================
-- ROLLBACK: Add invoice_type column
-- Version: 008
-- Date: 2026-01-05
-- Description: Rollback invoice_type column addition
-- ============================================

-- Drop indexes
DROP INDEX IF EXISTS idx_invoices_type_status;
DROP INDEX IF EXISTS idx_invoices_invoice_type;

-- Drop the column
ALTER TABLE invoices
DROP COLUMN invoice_type;
