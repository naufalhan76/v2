-- =============================================================================
-- Wave A, Task 2: Drop RLS & Supabase Auth dependencies (Clerk migration)
-- =============================================================================
-- Clerk user IDs are strings like 'user_2abc123', NOT UUIDs.
-- RLS is removed entirely — application code enforces data isolation.
-- This migration is IDEMPOTENT (uses IF EXISTS everywhere possible).
-- =============================================================================

-- =============================================================================
-- 1. DROP ALL RLS POLICIES ON PUBLIC SCHEMA TABLES
--    Dynamic approach: iterate pg_policies and drop each one.
-- =============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Drop storage.objects policies (created by 06_storage_service_photos_bucket.sql
-- and 20260616_storage_service_photos_private.sql) — auth.uid() dependent
DROP POLICY IF EXISTS "Technicians can upload service photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read service-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read service-photos" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can update service photos" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can delete service photos" ON storage.objects;

-- =============================================================================
-- 2. DROP HELPER FUNCTIONS that depend on auth.uid() / auth.role()
-- =============================================================================
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_technician_id();

-- =============================================================================
-- 3. DROP FK CONSTRAINTS referencing auth.users(id)
--    Uses information_schema for dynamic discovery (constraint names vary).
-- =============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_schema, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      r.table_schema, r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- =============================================================================
-- 4. DROP UNIQUE CONSTRAINTS ON auth_user_id columns
--    Must be dropped before changing column type, then recreated.
-- =============================================================================
ALTER TABLE public.user_management DROP CONSTRAINT IF EXISTS user_management_auth_user_id_key;
ALTER TABLE public.technicians DROP CONSTRAINT IF EXISTS technicians_auth_user_id_key;

-- =============================================================================
-- 5. ALTER COLUMN TYPE: UUID → TEXT for all auth.users user-ID columns
--    Clerk user IDs are TEXT strings like 'user_2abc123'.
-- =============================================================================

-- user_management.auth_user_id: was UUID REFERENCES auth.users(id)
ALTER TABLE public.user_management ALTER COLUMN auth_user_id TYPE TEXT;

-- technicians.auth_user_id: was UUID REFERENCES auth.users(id)
ALTER TABLE public.technicians ALTER COLUMN auth_user_id TYPE TEXT;

-- orders.created_by: was UUID REFERENCES auth.users(id)
ALTER TABLE public.orders ALTER COLUMN created_by TYPE TEXT;

-- invoice_communications.sent_by: was UUID REFERENCES auth.users(id)
ALTER TABLE public.invoice_communications ALTER COLUMN sent_by TYPE TEXT;

-- push_subscriptions.user_id: was UUID NOT NULL REFERENCES auth.users(id)
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id TYPE TEXT;

-- audit_logs.user_id: was UUID REFERENCES auth.users(id)
ALTER TABLE public.audit_logs ALTER COLUMN user_id TYPE TEXT;

-- customer_reminders.sent_by: was UUID REFERENCES auth.users(id)
ALTER TABLE public.customer_reminders ALTER COLUMN sent_by TYPE TEXT;

-- order_technicians.removed_by: was UUID REFERENCES auth.users(id)
ALTER TABLE public.order_technicians ALTER COLUMN removed_by TYPE TEXT;

-- order_status_transitions.changed_by: was UUID REFERENCES auth.users(id)
ALTER TABLE public.order_status_transitions ALTER COLUMN changed_by TYPE TEXT;

-- Recreate UNIQUE constraints (on TEXT columns now)
ALTER TABLE public.user_management ADD CONSTRAINT user_management_auth_user_id_key UNIQUE (auth_user_id);
ALTER TABLE public.technicians ADD CONSTRAINT technicians_auth_user_id_key UNIQUE (auth_user_id);

-- =============================================================================
-- 6. DISABLE ROW LEVEL SECURITY on all public tables
-- =============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- =============================================================================
-- 7. DROP user_invites TABLE and invite_status ENUM
--    Superseded by Clerk invitations; no longer needed.
-- =============================================================================
DROP TABLE IF EXISTS public.user_invites CASCADE;
DROP TYPE IF EXISTS invite_status CASCADE;

-- =============================================================================
-- 8. REWRITE create_technician_identity() RPC
--    Now accepts Clerk user ID (TEXT) instead of Supabase auth UUID.
--    Same atomic two-table insert logic (user_management + technicians).
-- =============================================================================
DROP FUNCTION IF EXISTS public.create_technician_identity(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_technician_identity(
  p_clerk_user_id TEXT,
  p_full_name     TEXT,
  p_email         TEXT,
  p_contact       TEXT DEFAULT NULL,
  p_company       TEXT DEFAULT NULL
)
RETURNS TABLE (out_user_id TEXT, out_technician_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       TEXT;
  v_technician_id TEXT;
BEGIN
  IF p_clerk_user_id IS NULL OR p_clerk_user_id = '' THEN
    RAISE EXCEPTION 'clerk_user_id is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_management WHERE auth_user_id = p_clerk_user_id)
     OR EXISTS (SELECT 1 FROM public.technicians WHERE auth_user_id = p_clerk_user_id) THEN
    RAISE EXCEPTION 'identity already exists for clerk_user_id %', p_clerk_user_id
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.user_management (full_name, email, role, is_active, auth_user_id)
  VALUES (p_full_name, p_email, 'TECHNICIAN', TRUE, p_clerk_user_id)
  RETURNING user_id INTO v_user_id;

  INSERT INTO public.technicians (technician_name, email, contact_number, company, auth_user_id)
  VALUES (p_full_name, p_email, p_contact, p_company, p_clerk_user_id)
  RETURNING technician_id INTO v_technician_id;

  RETURN QUERY SELECT v_user_id, v_technician_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_technician_identity(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_technician_identity(text, text, text, text, text) TO service_role;

-- =============================================================================
-- End of Wave A, Task 2: Drop RLS & Supabase Auth dependencies
-- =============================================================================
