-- Migration: Add Foreign Key from orders.order_type to service_pricing.service_type
-- Date: 2025-10-08
-- Description: Enforce referential integrity between orders and service_pricing tables
-- Note: This changes service_pricing.service_type from TEXT to service_type ENUM

-- Step 1: Convert service_pricing.service_type from TEXT to service_type ENUM
ALTER TABLE service_pricing 
ALTER COLUMN service_type TYPE service_type USING service_type::service_type;

-- Step 2: First, ensure all service types exist in service_pricing
-- Insert any missing service types that exist in orders but not in service_pricing
INSERT INTO service_pricing (service_type, service_name, base_price, includes, description, duration_minutes, is_active)
SELECT DISTINCT 
  o.order_type,
  o.order_type::TEXT, -- Use order_type as temporary service_name
  0, -- Placeholder price
  '[]'::TEXT, -- Empty includes array
  'Auto-created from existing orders', -- Description
  60, -- Default duration
  true -- Active
FROM orders o
WHERE o.order_type IS NOT NULL
  AND o.order_type NOT IN (SELECT service_type FROM service_pricing)
ON CONFLICT (service_type) DO NOTHING;

-- Step 3: Add the foreign key constraint
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_order_type 
FOREIGN KEY (order_type) 
REFERENCES service_pricing(service_type)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Verification query (run this to check):
-- SELECT o.order_type, COUNT(*) as order_count
-- FROM orders o
-- LEFT JOIN service_pricing sp ON o.order_type = sp.service_type
-- WHERE sp.service_type IS NULL
-- GROUP BY o.order_type;
