-- =============================================================================
-- test_03_seed_catalog_split_duct.sql — Assertions for the Split Duct /
-- Standing Floor catalog seed (supabase/migrations/03_seed_catalog_split_duct.sql)
-- -----------------------------------------------------------------------------
-- Run AFTER applying the migrations in order against a database that already has
-- 00_v2_schema.sql, 02_seed_dimensions.sql, and 03_seed_catalog_split_duct.sql.
--
-- Wrapped in a transaction that always ROLLBACKs: the script re-applies the seed
-- a second time to prove idempotency, then checks counts/prices/flags, and
-- finally rolls back so the database is left untouched.
--
-- Any failed assertion raises an exception and aborts the script with a clear
-- message, so a non-zero psql exit code signals a failing test.
-- =============================================================================
BEGIN;

\i supabase/migrations/03_seed_catalog_split_duct.sql

DO $$
DECLARE
  sd_total      INT;
  sf_total      INT;
  sd_active     INT;
  sf_active     INT;
  sd_blank      INT;
  sf_blank      INT;
  bad_blank     INT;
  price_chk_23  NUMERIC;
  price_kd_23   NUMERIC;
  price_chk_45  NUMERIC;
  price_chk_68  NUMERIC;
  price_sf_chk  NUMERIC;
  price_sf_kd6  NUMERIC;
BEGIN
  SELECT COUNT(*) INTO sd_total
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Split Duct';

  SELECT COUNT(*) INTO sf_total
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Standing Floor';

  IF sd_total <> 21 THEN
    RAISE EXCEPTION 'Expected 21 Split Duct catalog rows, found %', sd_total;
  END IF;
  IF sf_total <> 14 THEN
    RAISE EXCEPTION 'Expected 14 Standing Floor catalog rows, found %', sf_total;
  END IF;

  SELECT COUNT(*) INTO sd_active
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Split Duct' AND sc.is_active;

  SELECT COUNT(*) INTO sf_active
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Standing Floor' AND sc.is_active;

  IF sd_active <> 15 THEN
    RAISE EXCEPTION 'Expected 15 active Split Duct rows (5 priced x 3 bands), found %', sd_active;
  END IF;
  IF sf_active <> 10 THEN
    RAISE EXCEPTION 'Expected 10 active Standing Floor rows (5 priced x 2 bands), found %', sf_active;
  END IF;

  SELECT COUNT(*) INTO sd_blank
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Split Duct' AND sc.base_price = 0 AND NOT sc.is_active;

  SELECT COUNT(*) INTO sf_blank
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name = 'Standing Floor' AND sc.base_price = 0 AND NOT sc.is_active;

  IF sd_blank <> 6 THEN
    RAISE EXCEPTION 'Expected 6 blank-price Split Duct rows (CL_MIN/CL_MAJ x 3 bands), found %', sd_blank;
  END IF;
  IF sf_blank <> 4 THEN
    RAISE EXCEPTION 'Expected 4 blank-price Standing Floor rows (CL_MIN/CL_MAJ x 2 bands), found %', sf_blank;
  END IF;

  SELECT COUNT(*) INTO bad_blank
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name IN ('Split Duct', 'Standing Floor')
    AND ((sc.base_price = 0) <> (NOT sc.is_active));

  IF bad_blank <> 0 THEN
    RAISE EXCEPTION 'Found % rows where base_price=0 and is_active disagree', bad_blank;
  END IF;

  SELECT base_price INTO price_chk_23 FROM public.service_catalog WHERE msn_code = 'SD-CHK-2-3';
  SELECT base_price INTO price_kd_23  FROM public.service_catalog WHERE msn_code = 'SD-KD-2-3';
  SELECT base_price INTO price_chk_45 FROM public.service_catalog WHERE msn_code = 'SD-CHK-4-5';
  SELECT base_price INTO price_chk_68 FROM public.service_catalog WHERE msn_code = 'SD-CHK-6-8';
  SELECT base_price INTO price_sf_chk FROM public.service_catalog WHERE msn_code = 'SF-CHK-3-5';
  SELECT base_price INTO price_sf_kd6 FROM public.service_catalog WHERE msn_code = 'SF-KD-6-10';

  IF price_chk_23 <> 125000 THEN
    RAISE EXCEPTION 'SD-CHK-2-3 expected 125000, found %', price_chk_23;
  END IF;
  IF price_kd_23 <> 500000 THEN
    RAISE EXCEPTION 'SD-KD-2-3 expected 500000, found %', price_kd_23;
  END IF;
  IF price_chk_45 <> 162500 THEN
    RAISE EXCEPTION 'SD-CHK-4-5 expected 162500 (~30%% above base), found %', price_chk_45;
  END IF;
  IF price_chk_68 <> 187500 THEN
    RAISE EXCEPTION 'SD-CHK-6-8 expected 187500 (~50%% above base), found %', price_chk_68;
  END IF;
  IF price_sf_chk <> 140000 THEN
    RAISE EXCEPTION 'SF-CHK-3-5 expected 140000, found %', price_sf_chk;
  END IF;
  IF price_sf_kd6 <> 825000 THEN
    RAISE EXCEPTION 'SF-KD-6-10 expected 825000, found %', price_sf_kd6;
  END IF;

  IF price_sf_chk <= price_chk_23 THEN
    RAISE EXCEPTION 'Standing Floor base (%) should exceed Split Duct base (%)', price_sf_chk, price_chk_23;
  END IF;

  RAISE NOTICE 'OK: Split Duct (21) + Standing Floor (14) seeded, idempotent, prices verified.';
END $$;

ROLLBACK;
-- =============================================================================
-- End of test_03_seed_catalog_split_duct.sql
-- =============================================================================
