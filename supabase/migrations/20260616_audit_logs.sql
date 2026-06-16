CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only SUPERADMIN can read audit logs" ON audit_logs;
CREATE POLICY "Only SUPERADMIN can read audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_management WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'));
-- Allow inserts from authenticated users (for audit logging)
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
