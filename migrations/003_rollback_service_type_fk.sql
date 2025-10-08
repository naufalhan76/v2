-- Rollback Migration: Remove Foreign Key from orders.order_type
-- Date: 2025-10-08
-- Description: Remove the foreign key constraint and revert service_type to TEXT

-- Step 1: Drop the foreign key constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS fk_orders_order_type;

-- Step 2: Drop the index
DROP INDEX IF EXISTS idx_orders_order_type;

-- Step 3: Revert service_pricing.service_type from ENUM back to TEXT
ALTER TABLE service_pricing 
ALTER COLUMN service_type TYPE TEXT USING service_type::TEXT;

-- Note: This will not remove any auto-created service_pricing entries
-- If you want to remove those, run:
-- DELETE FROM service_pricing 
-- WHERE description = 'Auto-created from existing orders';
