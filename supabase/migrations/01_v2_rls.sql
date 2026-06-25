-- =============================================================================
-- MSN ERP V2 — RLS Policies
-- Apply AFTER 00_v2_schema.sql
-- =============================================================================

-- Helper function: get current user's role from user_management
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS role_type
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_management
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- Helper: get current user's technician_id (NULL if not a technician)
CREATE OR REPLACE FUNCTION public.current_technician_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT technician_id FROM public.technicians
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
ALTER TABLE public.user_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY; -- dropped in 11_drop_service_pricing
ALTER TABLE public.addon_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_sync_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USER MANAGEMENT (only superadmin manages, all auth users can read own)
-- =============================================================================
CREATE POLICY "user_mgmt_self_read" ON public.user_management
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "user_mgmt_admin_read_all" ON public.user_management
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN', 'FINANCE'));

CREATE POLICY "user_mgmt_superadmin_write" ON public.user_management
  FOR ALL TO authenticated
  USING (current_user_role() = 'SUPERADMIN')
  WITH CHECK (current_user_role() = 'SUPERADMIN');

-- =============================================================================
-- TECHNICIANS (admin/super manage; finance read-only; technicians read own row)
-- =============================================================================
CREATE POLICY "technicians_admin_write" ON public.technicians
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "technicians_finance_read" ON public.technicians
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

CREATE POLICY "technicians_self_read" ON public.technicians
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- =============================================================================
-- REFERENCE DATA (all authenticated read; admin/super write)
-- =============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ac_brands', 'unit_types', 'capacity_ranges',
    'service_types', 'service_catalog', 'addon_catalog'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "%I_read_all" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_admin_write" ON public.%I FOR ALL TO authenticated ' ||
      'USING (current_user_role() IN (''SUPERADMIN'', ''ADMIN'')) ' ||
      'WITH CHECK (current_user_role() IN (''SUPERADMIN'', ''ADMIN''))',
      t, t
    );
  END LOOP;
END $$;

-- =============================================================================
-- CUSTOMERS / LOCATIONS / AC UNITS
-- (admin/super: full access, finance: read-only, technician: read assigned only)
-- =============================================================================
CREATE POLICY "customers_admin_all" ON public.customers
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "customers_finance_read" ON public.customers
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

CREATE POLICY "customers_tech_read_assigned" ON public.customers
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'TECHNICIAN'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_technicians ot ON ot.order_id = o.order_id
      WHERE o.customer_id = customers.customer_id
        AND ot.technician_id = current_technician_id()
    )
  );

CREATE POLICY "locations_admin_all" ON public.locations
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "locations_finance_tech_read" ON public.locations
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('FINANCE', 'TECHNICIAN'));

CREATE POLICY "ac_units_admin_all" ON public.ac_units
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "ac_units_finance_tech_read" ON public.ac_units
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('FINANCE', 'TECHNICIAN'));

-- =============================================================================
-- ORDERS
-- =============================================================================
CREATE POLICY "orders_admin_all" ON public.orders
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "orders_finance_read" ON public.orders
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

CREATE POLICY "orders_tech_read_own" ON public.orders
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'TECHNICIAN'
    AND EXISTS (
      SELECT 1 FROM public.order_technicians ot
      WHERE ot.order_id = orders.order_id
        AND ot.technician_id = current_technician_id()
    )
  );

-- Technicians can update status (handled by API, but RLS enforces row-level)
CREATE POLICY "orders_tech_update_own" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'TECHNICIAN'
    AND EXISTS (
      SELECT 1 FROM public.order_technicians ot
      WHERE ot.order_id = orders.order_id
        AND ot.technician_id = current_technician_id()
        AND ot.role = 'lead'
    )
  );

-- order_items / order_addons follow the same pattern
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_items', 'order_addons', 'order_status_transitions']
  LOOP
    EXECUTE format(
      'CREATE POLICY "%I_admin_all" ON public.%I FOR ALL TO authenticated ' ||
      'USING (current_user_role() IN (''SUPERADMIN'', ''ADMIN'')) ' ||
      'WITH CHECK (current_user_role() IN (''SUPERADMIN'', ''ADMIN''))',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%I_finance_read" ON public.%I FOR SELECT TO authenticated ' ||
      'USING (current_user_role() = ''FINANCE'')',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%I_tech_read_own" ON public.%I FOR SELECT TO authenticated ' ||
      'USING (current_user_role() = ''TECHNICIAN'' AND EXISTS (' ||
      'SELECT 1 FROM public.order_technicians ot WHERE ot.order_id = %I.order_id ' ||
      'AND ot.technician_id = current_technician_id()))',
      t, t, t
    );
  END LOOP;
END $$;

-- order_technicians special-cased (FK on technician_id needs different check)
CREATE POLICY "order_technicians_admin_all" ON public.order_technicians
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "order_technicians_finance_read" ON public.order_technicians
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

CREATE POLICY "order_technicians_self_read" ON public.order_technicians
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'TECHNICIAN'
    AND technician_id = current_technician_id()
  );

-- =============================================================================
-- SERVICE REPORTS
-- =============================================================================
CREATE POLICY "service_reports_tech_insert_own" ON public.service_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    technician_id = current_technician_id()
    AND EXISTS (
      SELECT 1 FROM public.order_technicians ot
      WHERE ot.order_id = service_reports.order_id
        AND ot.technician_id = service_reports.technician_id
        AND ot.role = 'lead'
    )
  );

CREATE POLICY "service_reports_tech_read_own" ON public.service_reports
  FOR SELECT TO authenticated
  USING (technician_id = current_technician_id());

CREATE POLICY "service_reports_admin_read" ON public.service_reports
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN', 'FINANCE'));

CREATE POLICY "service_reports_admin_update" ON public.service_reports
  FOR UPDATE TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "service_records_admin_write" ON public.service_records
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "service_records_finance_read" ON public.service_records
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

CREATE POLICY "service_reminders_admin_all" ON public.service_reminders
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN', 'FINANCE'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

-- =============================================================================
-- INVOICES & PAYMENTS
-- =============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'invoices', 'invoice_items', 'invoice_communications',
    'invoice_configuration', 'payment_records', 'payments'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "%I_finance_admin" ON public.%I FOR ALL TO authenticated ' ||
      'USING (current_user_role() IN (''SUPERADMIN'', ''ADMIN'', ''FINANCE'')) ' ||
      'WITH CHECK (current_user_role() IN (''SUPERADMIN'', ''ADMIN'', ''FINANCE''))',
      t, t
    );
  END LOOP;
END $$;

-- =============================================================================
-- PUSH SUBSCRIPTIONS (each user manages own)
-- =============================================================================
CREATE POLICY "push_subs_self" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- SHEET SYNC CONFIG (superadmin only)
-- =============================================================================
CREATE POLICY "sheet_sync_superadmin" ON public.sheet_sync_config
  FOR ALL TO authenticated
  USING (current_user_role() = 'SUPERADMIN')
  WITH CHECK (current_user_role() = 'SUPERADMIN');
