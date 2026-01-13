-- ============================================
-- MIGRATION: Add Payment Account Info to Invoices
-- Version: 009
-- Date: 2026-01-14
-- Description: Add payment account fields to invoices table
-- ============================================

-- Add payment account columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_account_id TEXT,
ADD COLUMN IF NOT EXISTS payment_account_label TEXT,
ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
ADD COLUMN IF NOT EXISTS payment_account_number TEXT,
ADD COLUMN IF NOT EXISTS payment_account_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN invoices.payment_account_id IS 'ID of the payment account from invoice config';
COMMENT ON COLUMN invoices.payment_account_label IS 'Display label like "Payment Account 1"';
COMMENT ON COLUMN invoices.payment_bank_name IS 'Bank name (e.g., Bank Mandiri, BCA)';
COMMENT ON COLUMN invoices.payment_account_number IS 'Bank account number';
COMMENT ON COLUMN invoices.payment_account_name IS 'Account holder name';
