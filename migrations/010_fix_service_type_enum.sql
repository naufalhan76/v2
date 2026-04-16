-- =============================================
-- Migration: Add New Enum Values for service_type
-- =============================================

-- Tipe service di order_items direferensikan oleh tipe ENUM service_type.
-- Migrasi ini perlu dijalankan untuk mengatasi error `invalid input value for enum service_type: "CHECKING"`.
-- Kita menambahkan value baru sebagai pendukung migrasi `service_types` table.

-- Note: In PostgreSQL, `ALTER TYPE ... ADD VALUE` cannot be executed inside a transaction block.
-- If this fails on Supabase, run these lines one by one without BEGIN/COMMIT blocks.

ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'CHECKING';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'UNINSTALL';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'REFILL_FREON';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'MAINTENANCE';
