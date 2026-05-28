-- Phase 7 DB Integrity Fixes
-- Task 7.2: Unique constraint on customer_reminders to prevent duplicate generation
ALTER TABLE public.customer_reminders
  ADD CONSTRAINT uq_reminder_ac_rule_due UNIQUE (ac_unit_id, rule_id, due_date);

-- Task 7.4: Unique constraint on order_technicians
ALTER TABLE public.order_technicians
  ADD CONSTRAINT uq_order_tech_role UNIQUE (order_id, technician_id, role);

-- Task 7.8: CHECK constraints on invoices text columns
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('DRAFT','SENT','PARTIAL_PAID','PAID','CANCELLED','OVERDUE')),
  ADD CONSTRAINT invoices_payment_status_check CHECK (payment_status IN ('UNPAID','PARTIAL','PAID','FAILED','REFUNDED')),
  ADD CONSTRAINT invoices_type_check CHECK (invoice_type IN ('PROFORMA','FINAL'));

-- Task 7.9: Missing indexes on hot FK columns
CREATE INDEX IF NOT EXISTS idx_locations_customer ON public.locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_comms_invoice ON public.invoice_communications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_service_records_order ON public.service_records(order_id);
CREATE INDEX IF NOT EXISTS idx_service_records_tech ON public.service_records(technician_id);
CREATE INDEX IF NOT EXISTS idx_order_items_ac_unit ON public.order_items(ac_unit_id);

-- Task 7.10: CHECK constraint on order_technicians.role
ALTER TABLE public.order_technicians
  DROP CONSTRAINT IF EXISTS order_technicians_role_check;
ALTER TABLE public.order_technicians
  ADD CONSTRAINT order_technicians_role_check CHECK (role IN ('lead', 'helper'));

-- Task 7.11: Fix SECURITY DEFINER functions — add SET search_path
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS role_type
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_management
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_technician_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT technician_id FROM public.technicians
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- Task 7.12: Unique constraint on service_reports to prevent duplicate submissions
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_reports_order_tech
  ON public.service_reports(order_id, technician_id)
  WHERE deleted_at IS NULL;

-- Task 7.1 (partial): CHECK constraint on payment_records.amount
ALTER TABLE public.payment_records
  ADD CONSTRAINT payment_records_amount_positive CHECK (amount > 0);
