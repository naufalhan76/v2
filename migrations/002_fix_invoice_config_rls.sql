-- ============================================
-- MIGRATION: Fix Invoice Configuration RLS
-- Version: 002
-- Date: 2025-10-08
-- Description: Add RLS policies for invoice_configuration table
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to read invoice config" ON invoice_configuration;
DROP POLICY IF EXISTS "Allow authenticated users to update invoice config" ON invoice_configuration;
DROP POLICY IF EXISTS "Allow authenticated users to insert invoice config" ON invoice_configuration;

-- Create comprehensive RLS policies for invoice_configuration
CREATE POLICY "Allow authenticated users to read invoice config"
  ON invoice_configuration FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert invoice config"
  ON invoice_configuration FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update invoice config"
  ON invoice_configuration FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also add policies for other tables that might be missing
-- Service Pricing
DROP POLICY IF EXISTS "Allow authenticated users to insert service pricing" ON service_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to update service pricing" ON service_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to delete service pricing" ON service_pricing;

CREATE POLICY "Allow authenticated users to insert service pricing"
  ON service_pricing FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update service pricing"
  ON service_pricing FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete service pricing"
  ON service_pricing FOR DELETE
  TO authenticated
  USING (true);

-- Addon Catalog
DROP POLICY IF EXISTS "Allow authenticated users to insert addon catalog" ON addon_catalog;
DROP POLICY IF EXISTS "Allow authenticated users to update addon catalog" ON addon_catalog;
DROP POLICY IF EXISTS "Allow authenticated users to delete addon catalog" ON addon_catalog;

CREATE POLICY "Allow authenticated users to insert addon catalog"
  ON addon_catalog FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update addon catalog"
  ON addon_catalog FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete addon catalog"
  ON addon_catalog FOR DELETE
  TO authenticated
  USING (true);

-- Order Addons
DROP POLICY IF EXISTS "Allow authenticated users to manage order addons" ON order_addons;

CREATE POLICY "Allow authenticated users to manage order addons"
  ON order_addons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoices
DROP POLICY IF EXISTS "Allow authenticated users to manage invoices" ON invoices;

CREATE POLICY "Allow authenticated users to manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoice Items
DROP POLICY IF EXISTS "Allow authenticated users to manage invoice items" ON invoice_items;

CREATE POLICY "Allow authenticated users to manage invoice items"
  ON invoice_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payment Records
DROP POLICY IF EXISTS "Allow authenticated users to manage payment records" ON payment_records;

CREATE POLICY "Allow authenticated users to manage payment records"
  ON payment_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
