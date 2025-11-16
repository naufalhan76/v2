-- Rollback migration for order_technicians table

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_update_order_technicians_updated_at ON order_technicians;
DROP FUNCTION IF EXISTS update_order_technicians_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_order_technicians_order_id;
DROP INDEX IF EXISTS idx_order_technicians_technician_id;
DROP INDEX IF EXISTS idx_order_technicians_role;

-- Drop table
DROP TABLE IF EXISTS order_technicians;
