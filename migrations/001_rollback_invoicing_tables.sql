-- ============================================
-- ROLLBACK: Add-ons Based Invoicing System
-- Version: 001
-- Date: 2025-10-08
-- Description: Rollback migration for invoicing tables
-- WARNING: This will delete all invoicing data!
-- ============================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_service_pricing_updated_at ON service_pricing;
DROP TRIGGER IF EXISTS update_addon_catalog_updated_at ON addon_catalog;
DROP TRIGGER IF EXISTS update_order_addons_updated_at ON order_addons;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS payment_records CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS order_addons CASCADE;
DROP TABLE IF EXISTS addon_catalog CASCADE;
DROP TABLE IF EXISTS service_pricing CASCADE;
DROP TABLE IF EXISTS invoice_configuration CASCADE;

-- Drop indexes (will be dropped with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_order_addons_order_id;
DROP INDEX IF EXISTS idx_order_addons_addon_id;
DROP INDEX IF EXISTS idx_invoices_order_id;
DROP INDEX IF EXISTS idx_invoices_customer_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_payment_status;
DROP INDEX IF EXISTS idx_invoices_invoice_date;
DROP INDEX IF EXISTS idx_invoice_items_invoice_id;
DROP INDEX IF EXISTS idx_payment_records_invoice_id;
DROP INDEX IF EXISTS idx_service_pricing_service_type;
DROP INDEX IF EXISTS idx_addon_catalog_category;

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE 'Rollback completed successfully. All invoicing tables have been dropped.';
END $$;
