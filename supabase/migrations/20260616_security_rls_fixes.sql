-- BUG-008: user_invites RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only SUPERADMIN can manage invites" ON public.user_invites;
CREATE POLICY "Only SUPERADMIN can manage invites"
  ON public.user_invites FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_management 
    WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'
  ));

-- BUG-022+023: Scope TECHNICIAN access to ac_units and locations
-- Drop existing overly-permissive TECHNICIAN policies if they exist
DROP POLICY IF EXISTS "Technicians can view ac_units" ON public.ac_units;
DROP POLICY IF EXISTS "Technicians can view locations" ON public.locations;

-- order_technicians.technician_id is text business id (e.g. 'TECH8691') = user_management.user_id (text), NOT auth_user_id (uuid).
DROP POLICY IF EXISTS "Technicians scoped ac_units" ON public.ac_units;
CREATE POLICY "Technicians scoped ac_units" ON public.ac_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_management WHERE auth_user_id = auth.uid() AND role IN ('SUPERADMIN', 'ADMIN', 'FINANCE'))
    OR EXISTS (
      SELECT 1 FROM order_items oi
      JOIN order_technicians ot ON ot.order_id = oi.order_id
      WHERE oi.ac_unit_id = ac_units.ac_unit_id
        AND ot.technician_id = (SELECT user_id FROM user_management WHERE auth_user_id = auth.uid())
    )
  );

-- TECHNICIAN can only see locations linked to their assigned orders
DROP POLICY IF EXISTS "Technicians scoped locations" ON public.locations;
CREATE POLICY "Technicians scoped locations" ON public.locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_management WHERE auth_user_id = auth.uid() AND role IN ('SUPERADMIN', 'ADMIN', 'FINANCE'))
    OR EXISTS (
      SELECT 1 FROM orders o
      JOIN order_technicians ot ON ot.order_id = o.order_id
      JOIN order_items oi ON oi.order_id = o.order_id
      WHERE oi.location_id = locations.location_id
        AND ot.technician_id = (SELECT user_id FROM user_management WHERE auth_user_id = auth.uid())
    )
  );
