-- Rollback for 017_tech_insert_status_transitions.sql
DROP POLICY IF EXISTS "order_status_transitions_tech_insert_own"
  ON public.order_status_transitions;
