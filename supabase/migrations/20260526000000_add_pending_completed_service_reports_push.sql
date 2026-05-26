-- Migration: Add PENDING/COMPLETED enum values, service_reports table, push_subscriptions table
-- Phase 0 of MSN ERP v2 restructure
-- Non-breaking: only ADDs, no drops or renames

-- =============================================================================
-- 1. Extend order_status enum with new values
-- =============================================================================
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPLETED';

-- =============================================================================
-- 2. Create service_reports table
-- =============================================================================
CREATE TABLE IF NOT EXISTS service_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  technician_id UUID NOT NULL REFERENCES technicians(technician_id),

  -- Photos (Supabase Storage URLs)
  photos_before TEXT[] DEFAULT '{}',
  photos_after TEXT[] DEFAULT '{}',

  -- Materials JSONB array
  -- Schema: [{ addon_id?: uuid, name: string, qty: number, unit_price: number, total: number }]
  materials JSONB DEFAULT '[]',

  -- Pricing
  actual_total_price NUMERIC(12,2) NOT NULL,

  -- Customer sign-off
  customer_signature_url TEXT,
  customer_name_signed TEXT,
  signed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Timing
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete (consistent with project convention)
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_reports_order
  ON service_reports(order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_reports_technician
  ON service_reports(technician_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_reports_submitted
  ON service_reports(submitted_at DESC) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- TECHNICIAN can INSERT report for their assigned orders
CREATE POLICY "tech_insert_own_report" ON service_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    technician_id = (SELECT technician_id FROM technicians WHERE auth_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM order_technicians
      WHERE order_id = service_reports.order_id
        AND technician_id = service_reports.technician_id
        AND role = 'lead'
    )
  );

-- TECHNICIAN can SELECT own reports (history)
CREATE POLICY "tech_select_own_reports" ON service_reports
  FOR SELECT TO authenticated
  USING (
    technician_id = (SELECT technician_id FROM technicians WHERE auth_user_id = auth.uid())
  );

-- ADMIN/SUPERADMIN/FINANCE can SELECT all reports
CREATE POLICY "admin_select_all_reports" ON service_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM user_management WHERE user_id = auth.uid())
    IN ('ADMIN', 'SUPERADMIN', 'FINANCE')
  );

-- =============================================================================
-- 3. Create push_subscriptions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "users_manage_own_push_subs" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
