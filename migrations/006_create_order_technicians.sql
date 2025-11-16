-- Create order_technicians table for many-to-many relationship
-- Supports unlimited helper technicians per order

CREATE TABLE IF NOT EXISTS order_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES technicians(technician_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('lead', 'helper')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure same technician can't be assigned twice to same order
  UNIQUE(order_id, technician_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_order_technicians_order_id ON order_technicians(order_id);
CREATE INDEX idx_order_technicians_technician_id ON order_technicians(technician_id);
CREATE INDEX idx_order_technicians_role ON order_technicians(role);

-- Enable RLS
ALTER TABLE order_technicians ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read order_technicians"
  ON order_technicians FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert order_technicians"
  ON order_technicians FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update order_technicians"
  ON order_technicians FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete order_technicians"
  ON order_technicians FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_order_technicians_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_technicians_updated_at
  BEFORE UPDATE ON order_technicians
  FOR EACH ROW
  EXECUTE FUNCTION update_order_technicians_updated_at();

-- Comments
COMMENT ON TABLE order_technicians IS 'Many-to-many relationship between orders and technicians with role designation';
COMMENT ON COLUMN order_technicians.role IS 'Technician role: lead (main technician) or helper';
COMMENT ON COLUMN order_technicians.assigned_at IS 'When the technician was assigned to this order';
