-- Migration: Seed default same-day reminder rule
-- Version: 015
-- Purpose: Insert a default reminder rule that fires on the day next_service_due_date
--          matches today (days_before_due = 0). Idempotent — safe to run multiple times.

INSERT INTO public.reminder_rules (
  name,
  days_before_due,
  channel,
  message_template,
  is_active,
  auto_send
)
SELECT
  'Default same-day',
  0,
  'WHATSAPP',
  'Halo {{customer_name}}, AC {{ac_brand}} {{ac_model}} di {{location}} hari ini jatuh tempo service rutin. Silakan hubungi kami untuk menjadwalkan kunjungan teknisi. Terima kasih.',
  TRUE,
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_rules WHERE name = 'Default same-day'
);
