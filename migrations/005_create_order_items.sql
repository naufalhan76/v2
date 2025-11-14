-- Migration: Create order_items table for multi-location, multi-service orders
-- This allows: 1 order → many locations → many AC units → many services

-- 1. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(location_id),
  ac_unit_id TEXT REFERENCES ac_units(ac_unit_id), -- NULL for new AC (to be filled by technician)
  service_type service_type NOT NULL,
  quantity INT DEFAULT 1 CHECK (quantity > 0), -- for new AC units
  description TEXT,
  estimated_price DECIMAL(12,2) DEFAULT 0,
  actual_price DECIMAL(12,2), -- filled by technician after service
  status order_status DEFAULT 'ACCEPTED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_location_id ON order_items(location_id);
CREATE INDEX IF NOT EXISTS idx_order_items_ac_unit_id ON order_items(ac_unit_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

-- 3. Add created_by column to orders table (track which admin created the order)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 4. Add order_item_id to service_records (link service to order item)
ALTER TABLE service_records 
ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(order_item_id);

-- 5. Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for order_items
CREATE POLICY "Users can view order items" ON order_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create order items" ON order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update order items" ON order_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete order items" ON order_items
  FOR DELETE USING (true);

-- 7. Grant permissions
GRANT ALL ON order_items TO authenticated;

-- 8. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_items_updated_at();

-- 9. Comments for documentation
COMMENT ON TABLE order_items IS 'Order items table for multi-location, multi-service orders';
COMMENT ON COLUMN order_items.ac_unit_id IS 'NULL for new AC units that will be registered by technician on-site';
COMMENT ON COLUMN order_items.quantity IS 'Number of AC units for new installations (when ac_unit_id is NULL)';
COMMENT ON COLUMN order_items.estimated_price IS 'Price estimate from service_pricing table';
COMMENT ON COLUMN order_items.actual_price IS 'Actual price after service completion (filled by technician)';
