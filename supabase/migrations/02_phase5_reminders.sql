-- =============================================================================
-- MSN ERP V2 — Phase 5 Schema Additions
-- 1. Service report: next-service recommendation field (technician input)
-- 2. Reminder rules: configurable thresholds + templates
-- 3. Customer reminders: queue per AC unit due for service
-- 4. Proforma invoice flag pre-existed; nothing to add
-- =============================================================================

-- service_reports: technician recommends next routine service date
ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS next_service_recommendation_date DATE,
  ADD COLUMN IF NOT EXISTS next_service_recommendation_notes TEXT;

-- ac_units: extend with next_service_due (denormalized for fast querying)
ALTER TABLE public.ac_units
  ADD COLUMN IF NOT EXISTS next_service_due_date DATE;

-- =============================================================================
-- reminder_rules — configurable templates + thresholds
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_rules (
  rule_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  days_before_due   INT NOT NULL DEFAULT 7,
  channel           TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (channel IN ('WHATSAPP', 'EMAIL')),
  message_template  TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  auto_send         BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_rules_admin_all" ON public.reminder_rules
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN'));

CREATE POLICY "reminder_rules_finance_read" ON public.reminder_rules
  FOR SELECT TO authenticated
  USING (current_user_role() = 'FINANCE');

-- Seed default rule
INSERT INTO public.reminder_rules (name, days_before_due, channel, message_template, is_active, auto_send)
VALUES (
  '7 hari sebelum jatuh tempo',
  7,
  'WHATSAPP',
  'Halo {{customer_name}}, AC {{ac_brand}} {{ac_model}} di {{location}} akan jatuh tempo service rutin pada {{due_date}}. Silakan hubungi kami untuk jadwal kunjungan. Terima kasih.',
  TRUE,
  FALSE
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- customer_reminders — generated reminder queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_reminders (
  reminder_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        TEXT REFERENCES public.customers(customer_id),
  ac_unit_id         TEXT REFERENCES public.ac_units(ac_unit_id),
  service_report_id  UUID REFERENCES public.service_reports(report_id),
  rule_id            UUID REFERENCES public.reminder_rules(rule_id),
  due_date           DATE NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL')),
  recipient          TEXT NOT NULL,
  message            TEXT NOT NULL,
  status             TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'DISMISSED')),
  sent_at            TIMESTAMPTZ,
  sent_by            UUID REFERENCES auth.users(id),
  external_id        TEXT,
  error_message      TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reminders_status_due
  ON public.customer_reminders(status, due_date);
CREATE INDEX IF NOT EXISTS idx_customer_reminders_customer
  ON public.customer_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_reminders_ac_unit
  ON public.customer_reminders(ac_unit_id);

ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_reminders_admin_all" ON public.customer_reminders
  FOR ALL TO authenticated
  USING (current_user_role() IN ('SUPERADMIN', 'ADMIN', 'FINANCE'))
  WITH CHECK (current_user_role() IN ('SUPERADMIN', 'ADMIN', 'FINANCE'));
