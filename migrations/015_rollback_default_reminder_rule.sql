-- Rollback: Remove default same-day reminder rule
-- Version: 015 rollback
-- Purpose: Reverses 015_default_reminder_rule.sql. Idempotent — safe to run
--          even if the row was never inserted or was already deleted.

DELETE FROM public.reminder_rules WHERE name = 'Default same-day';
