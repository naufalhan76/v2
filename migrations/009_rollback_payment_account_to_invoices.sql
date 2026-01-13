-- ============================================
-- ROLLBACK: Remove Payment Account Info from Invoices
-- Version: 009
-- Date: 2026-01-14
-- Description: Remove payment account fields from invoices table
-- ============================================

-- Remove payment account columns from invoices table
ALTER TABLE invoices 
DROP COLUMN IF EXISTS payment_account_id,
DROP COLUMN IF EXISTS payment_account_label,
DROP COLUMN IF EXISTS payment_bank_name,
DROP COLUMN IF EXISTS payment_account_number,
DROP COLUMN IF EXISTS payment_account_name;
