-- =============================================================================
-- 05_identity_and_addon_requests.sql
-- -----------------------------------------------------------------------------
-- Two concerns, one migration (idempotent, safe to re-run):
--   1. IDENTITY: collision-safe PK generators + atomic technician onboarding RPC
--   2. ADDON REQUESTS: technician part-request queue with admin-approval RPC
--
-- Architecture decision (per Oracle review): application code is the single
-- writer for user_management + technicians. NO handle_new_user trigger exists
-- or is added — a generic auth trigger cannot mint TECH#### rows and would
-- create a double-insert conflict. Atomicity for the two app-owned rows is
-- provided by SECURITY DEFINER RPCs below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. COLLISION-SAFE PRIMARY KEY GENERATORS
--    Existing defaults use floor(random()*10000) → only 10k values, ~50%
--    collision at ~118 rows (birthday paradox). Switch to sequence-backed
--    defaults. Existing rows are untouched; only future inserts change.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.user_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.technician_id_seq;

-- Advance each sequence past any existing numeric suffixes to avoid clashes
-- with rows created under the old random scheme.
SELECT setval(
  'public.user_id_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(user_id, '\D', '', 'g'), ''))::bigint, 0)
       FROM public.user_management),
    1000
  )
);

SELECT setval(
  'public.technician_id_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(technician_id, '\D', '', 'g'), ''))::bigint, 0)
       FROM public.technicians),
    1000
  )
);

ALTER TABLE public.user_management
  ALTER COLUMN user_id SET DEFAULT ('MSN' || lpad(nextval('public.user_id_seq')::text, 4, '0'));

ALTER TABLE public.technicians
  ALTER COLUMN technician_id SET DEFAULT ('TECH' || lpad(nextval('public.technician_id_seq')::text, 4, '0'));

-- -----------------------------------------------------------------------------
-- 2. ATOMIC TECHNICIAN ONBOARDING
--    Inserts BOTH the user_management (role=TECHNICIAN) and technicians rows in
--    one transaction, linked by auth_user_id. The caller (server action) first
--    creates the Supabase auth user, then calls this with the resulting auth id.
--    If this RPC raises, the caller deletes the orphaned auth user.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_technician_identity(
  p_auth_user_id  uuid,
  p_full_name     text,
  p_email         text,
  p_contact       text DEFAULT NULL,
  p_company       text DEFAULT NULL
)
RETURNS TABLE (out_user_id text, out_technician_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       text;
  v_technician_id text;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_id is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_management WHERE auth_user_id = p_auth_user_id)
     OR EXISTS (SELECT 1 FROM public.technicians WHERE auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'identity already exists for auth_user_id %', p_auth_user_id
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.user_management (full_name, email, role, is_active, auth_user_id)
  VALUES (p_full_name, p_email, 'TECHNICIAN', TRUE, p_auth_user_id)
  RETURNING user_id INTO v_user_id;

  INSERT INTO public.technicians (technician_name, email, contact_number, company, auth_user_id)
  VALUES (p_full_name, p_email, p_contact, p_company, p_auth_user_id)
  RETURNING technician_id INTO v_technician_id;

  RETURN QUERY SELECT v_user_id, v_technician_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_technician_identity(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_technician_identity(uuid, text, text, text, text) TO service_role;

-- 3. addon_requests — technician part-request queue
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'addon_request_status') THEN
    CREATE TYPE public.addon_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.addon_requests (
  request_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_technician_id  text NOT NULL REFERENCES public.technicians(technician_id),
  category                    text NOT NULL,
  item_name                   text NOT NULL,
  proposed_unit_price         numeric,
  unit_of_measure             text DEFAULT 'pcs',
  description                 text,
  applicable_service_types    text,
  status                      public.addon_request_status NOT NULL DEFAULT 'PENDING',
  reviewed_by                 text REFERENCES public.user_management(user_id),
  reviewed_at                 timestamptz,
  review_notes                text,
  resulting_addon_id          uuid REFERENCES public.addon_catalog(addon_id),
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addon_requests_status
  ON public.addon_requests (status);
CREATE INDEX IF NOT EXISTS idx_addon_requests_technician
  ON public.addon_requests (requested_by_technician_id);

-- -----------------------------------------------------------------------------
-- 4. APPROVE RPC — atomic: insert into addon_catalog + flip request to APPROVED
--    Admin supplies the FINAL item_code, price and initial stock. Row is locked
--    FOR UPDATE and guarded on status='PENDING' to kill the double-approve race.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_addon_request(
  p_request_id      uuid,
  p_item_code       text,
  p_final_unit_price numeric,
  p_initial_stock   numeric DEFAULT 0,
  p_minimum_stock   numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.addon_requests%ROWTYPE;
  v_reviewer_id text;
  v_addon_id    uuid;
BEGIN
  IF public.current_user_role() NOT IN ('ADMIN', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT * INTO v_req FROM public.addon_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Request already processed (status=%)', v_req.status;
  END IF;

  SELECT user_id INTO v_reviewer_id FROM public.user_management
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.addon_catalog (
    category, item_name, item_code, description,
    unit_of_measure, unit_price, stock_quantity, minimum_stock,
    applicable_service_types, is_active
  )
  VALUES (
    v_req.category, v_req.item_name, NULLIF(p_item_code, ''), v_req.description,
    COALESCE(v_req.unit_of_measure, 'pcs'), p_final_unit_price,
    COALESCE(p_initial_stock, 0), COALESCE(p_minimum_stock, 0),
    v_req.applicable_service_types, TRUE
  )
  RETURNING addon_id INTO v_addon_id;

  UPDATE public.addon_requests
  SET status = 'APPROVED',
      reviewed_by = v_reviewer_id,
      reviewed_at = now(),
      resulting_addon_id = v_addon_id,
      updated_at = now()
  WHERE request_id = p_request_id;

  RETURN v_addon_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_addon_request(uuid, text, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_addon_request(uuid, text, numeric, numeric, numeric) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. REJECT RPC — flip request to REJECTED with a reason
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_addon_request(
  p_request_id uuid,
  p_notes      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.addon_requests%ROWTYPE;
  v_reviewer_id text;
BEGIN
  IF public.current_user_role() NOT IN ('ADMIN', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT * INTO v_req FROM public.addon_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Request already processed (status=%)', v_req.status;
  END IF;

  SELECT user_id INTO v_reviewer_id FROM public.user_management
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  UPDATE public.addon_requests
  SET status = 'REJECTED',
      reviewed_by = v_reviewer_id,
      reviewed_at = now(),
      review_notes = p_notes,
      updated_at = now()
  WHERE request_id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_addon_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_addon_request(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. RLS for addon_requests
--    Technicians: INSERT own (status forced PENDING) + SELECT own.
--    Admins: SELECT all + UPDATE (status changes happen via RPC, but admin
--    needs UPDATE privilege for the RPC's SECURITY DEFINER context aside).
-- -----------------------------------------------------------------------------
ALTER TABLE public.addon_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addon_requests_tech_insert ON public.addon_requests;
CREATE POLICY addon_requests_tech_insert ON public.addon_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_technician_id = public.current_technician_id()
    AND status = 'PENDING'
  );

DROP POLICY IF EXISTS addon_requests_tech_select ON public.addon_requests;
CREATE POLICY addon_requests_tech_select ON public.addon_requests
  FOR SELECT TO authenticated
  USING (
    requested_by_technician_id = public.current_technician_id()
    OR public.current_user_role() IN ('ADMIN', 'SUPERADMIN')
  );

DROP POLICY IF EXISTS addon_requests_admin_update ON public.addon_requests;
CREATE POLICY addon_requests_admin_update ON public.addon_requests
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('ADMIN', 'SUPERADMIN'));

-- =============================================================================
-- End of 05_identity_and_addon_requests.sql
-- =============================================================================
