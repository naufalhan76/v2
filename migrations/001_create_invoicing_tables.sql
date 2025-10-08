-- ============================================
-- MIGRATION: Add-ons Based Invoicing System
-- Version: 001
-- Date: 2025-10-08
-- Description: Create tables for invoicing with add-ons support
-- ============================================

-- Table 1: Service Pricing Configuration (Base Prices)
CREATE TABLE IF NOT EXISTS service_pricing (
  pricing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL UNIQUE,
  service_name TEXT NOT NULL,
  base_price NUMERIC(12,2) NOT NULL,
  
  -- What's included in base service
  includes TEXT, -- JSON string: ["Visual inspection", "Basic cleaning", "Performance test"]
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Add-ons Catalog (Parts, Freon, Labor, etc.)
CREATE TABLE IF NOT EXISTS addon_catalog (
  addon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- PARTS, FREON, LABOR, TRANSPORTATION, OTHER
  
  item_name TEXT NOT NULL,
  item_code TEXT UNIQUE,
  description TEXT,
  
  -- Pricing
  unit_of_measure TEXT DEFAULT 'pcs', -- pcs, kg, hours, visit, meter
  unit_price NUMERIC(12,2) NOT NULL,
  
  -- Optional: inventory tracking
  stock_quantity NUMERIC(10,2) DEFAULT 0,
  minimum_stock NUMERIC(10,2) DEFAULT 0,
  
  -- Applicable to which services (NULL = all services)
  applicable_service_types TEXT, -- JSON array: ["CLEANING", "REPAIR"]
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Order Add-ons (Track add-ons used per order)
CREATE TABLE IF NOT EXISTS order_addons (
  order_addon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  
  -- Reference to catalog OR custom item
  addon_id UUID REFERENCES addon_catalog(addon_id),
  
  -- Custom item (if addon_id is NULL)
  custom_item_name TEXT,
  custom_category TEXT,
  custom_description TEXT,
  
  -- Quantity & Pricing
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL, -- Price at time of transaction
  total_price NUMERIC(12,2) NOT NULL, -- quantity * unit_price
  
  -- Metadata
  notes TEXT,
  added_by UUID REFERENCES user_management(auth_user_id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 4: Invoices
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  
  -- References
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  
  -- Base Service
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  base_service_quantity INTEGER DEFAULT 1,
  base_service_price NUMERIC(12,2) NOT NULL, -- Price per unit
  base_service_total NUMERIC(12,2) NOT NULL, -- quantity * price
  
  -- Totals
  addons_subtotal NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL, -- base + addons
  discount_amount NUMERIC(12,2) DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  tax_percentage NUMERIC(5,2) DEFAULT 11, -- Default PPN 11%
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
  payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID
  paid_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  terms_conditions TEXT,
  
  -- Metadata
  created_by UUID REFERENCES user_management(auth_user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 5: Invoice Items (Line items including base service and add-ons)
CREATE TABLE IF NOT EXISTS invoice_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  
  item_type TEXT NOT NULL, -- BASE_SERVICE, ADDON
  description TEXT NOT NULL,
  
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  
  -- Optional references
  service_type TEXT, -- For base service
  addon_id UUID REFERENCES addon_catalog(addon_id),
  order_addon_id UUID REFERENCES order_addons(order_addon_id),
  
  -- Display order
  line_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 6: Payment Records
CREATE TABLE IF NOT EXISTS payment_records (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
  
  payment_date DATE NOT NULL,
  payment_method TEXT, -- CASH, TRANSFER, CREDIT_CARD, DEBIT_CARD, QRIS, OTHER
  amount NUMERIC(12,2) NOT NULL,
  
  reference_number TEXT, -- Transfer reference, receipt number, etc.
  notes TEXT,
  
  -- Metadata
  recorded_by UUID REFERENCES user_management(auth_user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 7: Invoice Configuration (Company info, bank details, terms)
CREATE TABLE IF NOT EXISTS invoice_configuration (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Information
  company_name TEXT NOT NULL,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  
  -- Tax Information
  npwp TEXT, -- Nomor Pokok Wajib Pajak
  tax_id TEXT,
  
  -- Bank Details (JSON for multiple accounts)
  bank_accounts TEXT, -- JSON: [{"bank": "BCA", "account_number": "123456", "account_name": "PT XYZ"}]
  
  -- Invoice Settings
  default_due_days INTEGER DEFAULT 30,
  default_tax_percentage NUMERIC(5,2) DEFAULT 11,
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_notes_template TEXT,
  terms_conditions_template TEXT,
  
  -- Logo
  logo_url TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES user_management(auth_user_id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_addons_order_id ON order_addons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_addons_addon_id ON order_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_id ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_service_type ON service_pricing(service_type);
CREATE INDEX IF NOT EXISTS idx_addon_catalog_category ON addon_catalog(category);

-- Insert default invoice configuration
INSERT INTO invoice_configuration (
  company_name,
  company_address,
  company_phone,
  company_email,
  default_due_days,
  default_tax_percentage,
  invoice_prefix,
  terms_conditions_template
) VALUES (
  'Your Company Name',
  'Company Address Here',
  '+62 21 1234567',
  'info@company.com',
  30,
  11,
  'INV',
  'Payment due within 30 days from invoice date. Late payment may incur additional charges.'
) ON CONFLICT DO NOTHING;

-- Insert sample service pricing data
INSERT INTO service_pricing (service_type, service_name, base_price, includes, description, duration_minutes) VALUES
('CLEANING', 'AC Cleaning Service', 150000, '["Visual inspection", "Coil cleaning", "Filter cleaning", "Performance test"]', 'Standard AC cleaning service for 1 unit', 60),
('REFILL_FREON', 'Freon Refill Service', 300000, '["Leak detection", "Freon refill", "Performance test"]', 'Freon refill service including leak check', 90),
('REPAIR', 'AC Repair Service', 200000, '["Diagnosis", "Basic troubleshooting", "Testing"]', 'Diagnostic and minor repair service (parts not included)', 90),
('INSTALLATION', 'AC Installation', 500000, '["Unit installation", "Piping", "Electrical connection", "Testing"]', 'Standard AC installation service', 180),
('INSPECTION', 'AC Inspection', 100000, '["Visual inspection", "Performance check", "Report"]', 'Comprehensive AC inspection service', 45)
ON CONFLICT (service_type) DO NOTHING;

-- Insert sample add-ons catalog
INSERT INTO addon_catalog (category, item_name, item_code, unit_of_measure, unit_price, description, applicable_service_types) VALUES
-- Parts
('PARTS', 'Capacitor 10uF', 'CAP-10UF', 'pcs', 50000, 'Standard capacitor 10 microfarad', '["REPAIR", "INSTALLATION"]'),
('PARTS', 'Capacitor 20uF', 'CAP-20UF', 'pcs', 60000, 'Standard capacitor 20 microfarad', '["REPAIR", "INSTALLATION"]'),
('PARTS', 'Compressor 1HP', 'COMP-1HP', 'pcs', 750000, 'Standard compressor 1 horsepower', '["REPAIR"]'),
('PARTS', 'Compressor 1.5HP', 'COMP-1.5HP', 'pcs', 900000, 'Standard compressor 1.5 horsepower', '["REPAIR"]'),
('PARTS', 'PCB Board', 'PCB-001', 'pcs', 300000, 'AC control board', '["REPAIR"]'),
('PARTS', 'Thermostat Digital', 'THERMO-DIG', 'pcs', 150000, 'Digital thermostat', '["REPAIR", "INSTALLATION"]'),
('PARTS', 'Remote Control', 'REMOTE-001', 'pcs', 100000, 'Universal AC remote control', '["REPAIR"]'),

-- Freon
('FREON', 'R410A Freon', 'FREON-410A', 'kg', 300000, 'R410A refrigerant per kilogram', '["REFILL", "REPAIR", "INSTALLATION"]'),
('FREON', 'R32 Freon', 'FREON-R32', 'kg', 250000, 'R32 refrigerant per kilogram', '["REFILL", "REPAIR", "INSTALLATION"]'),
('FREON', 'R22 Freon', 'FREON-R22', 'kg', 200000, 'R22 refrigerant per kilogram (phased out)', '["REFILL", "REPAIR"]'),

-- Labor
('LABOR', 'Overtime Charge', 'LABOR-OT', 'hour', 50000, 'Additional charge per hour for overtime work', NULL),
('LABOR', 'Weekend Surcharge', 'LABOR-WE', 'visit', 100000, 'Additional charge for weekend service', NULL),
('LABOR', 'Holiday Surcharge', 'LABOR-HOL', 'visit', 150000, 'Additional charge for holiday service', NULL),
('LABOR', 'Emergency Call', 'LABOR-EM', 'visit', 200000, 'Additional charge for emergency service', NULL),

-- Transportation
('TRANSPORTATION', 'Area Surcharge Zone 3', 'TRANS-Z3', 'visit', 50000, 'Additional charge for service area zone 3', NULL),
('TRANSPORTATION', 'Area Surcharge Zone 4', 'TRANS-Z4', 'visit', 75000, 'Additional charge for service area zone 4', NULL),
('TRANSPORTATION', 'Area Surcharge Zone 5', 'TRANS-Z5', 'visit', 100000, 'Additional charge for service area zone 5', NULL),

-- Materials
('OTHER', 'Piping 3 Meter', 'PIPE-3M', 'meter', 25000, 'AC piping per meter', '["INSTALLATION", "REPAIR"]'),
('OTHER', 'Cable 2.5mm', 'CABLE-2.5', 'meter', 15000, 'Electrical cable per meter', '["INSTALLATION", "REPAIR"]'),
('OTHER', 'Bracket Set', 'BRACKET-SET', 'set', 100000, 'Wall mounting bracket set', '["INSTALLATION"]')
ON CONFLICT (item_code) DO NOTHING;

-- Create function to auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  current_month TEXT;
  current_year TEXT;
  prefix TEXT;
BEGIN
  SELECT invoice_prefix INTO prefix FROM invoice_configuration WHERE is_active = true LIMIT 1;
  IF prefix IS NULL THEN
    prefix := 'INV';
  END IF;
  
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  current_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '(\d+)$') AS INTEGER)
  ), 0) + 1 INTO next_number
  FROM invoices
  WHERE invoice_number LIKE prefix || '/' || current_year || '/' || current_month || '/%';
  
  RETURN prefix || '/' || current_year || '/' || current_month || '/' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_pricing_updated_at BEFORE UPDATE ON service_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addon_catalog_updated_at BEFORE UPDATE ON addon_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_addons_updated_at BEFORE UPDATE ON order_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your RLS policies)
-- These are examples - adjust based on your security requirements
ALTER TABLE service_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_configuration ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (customize based on your requirements)
CREATE POLICY "Allow authenticated users to read service pricing"
  ON service_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read addon catalog"
  ON addon_catalog FOR SELECT
  TO authenticated
  USING (true);

-- Add more RLS policies as needed for your security model

COMMENT ON TABLE service_pricing IS 'Base service pricing configuration';
COMMENT ON TABLE addon_catalog IS 'Catalog of available add-ons (parts, freon, labor, etc.)';
COMMENT ON TABLE order_addons IS 'Add-ons used in each order';
COMMENT ON TABLE invoices IS 'Invoice headers with totals';
COMMENT ON TABLE invoice_items IS 'Invoice line items (base service + add-ons)';
COMMENT ON TABLE payment_records IS 'Payment history for invoices';
COMMENT ON TABLE invoice_configuration IS 'Company information and invoice settings';
