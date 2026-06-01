-- =============================================================================
-- test_03_seed_catalog_mnx_vrv.sql — Assertions for the MNX + VRV catalog seed
-- (supabase/migrations/03_seed_catalog_mnx_vrv.sql)
-- -----------------------------------------------------------------------------
-- Run AFTER applying the migrations in order against a database that already has
-- 00_v2_schema.sql, 02_seed_dimensions.sql, and 03_seed_catalog_mnx_vrv.sql.
--
-- Wrapped in a transaction that always ROLLBACKs: the script re-applies the seed
-- a second time to prove idempotency, then checks counts/prices/flags, and
-- finally rolls back so the database is left untouched.
--
-- Any failed assertion raises an exception and aborts the script with a clear
-- message, so a non-zero psql exit code signals a failing test.
-- =============================================================================
BEGIN;

\i supabase/migrations/03_seed_catalog_mnx_vrv.sql

DO $$
DECLARE
  mxw_total  INT;
  mxc_total  INT;
  mxo_total  INT;
  vw_total   INT;
  vcd_total  INT;
  vo_total   INT;
  bad_active INT;
  vcd_pg     INT;
  vo_pg      INT;
  vcd_pcek   INT;
  vo_pcek    INT;
  p_mxw_base NUMERIC;
  p_ra_base  NUMERIC;
  p_vcd_base NUMERIC;
  p_vcd_14   NUMERIC;
  p_vcd_18   NUMERIC;
  p_vcd_42   NUMERIC;
  p_vcd_ko   NUMERIC;
  p_vcd_el   NUMERIC;
  p_vo_base  NUMERIC;
  p_vo_ka    NUMERIC;
BEGIN
  SELECT COUNT(*) INTO mxw_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'MNX Wall';
  SELECT COUNT(*) INTO mxc_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'MNX Cassette/Duct';
  SELECT COUNT(*) INTO mxo_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'MNX Outdoor';
  SELECT COUNT(*) INTO vw_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'VRV Wall';
  SELECT COUNT(*) INTO vcd_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'VRV Cassette Ducting';
  SELECT COUNT(*) INTO vo_total FROM public.service_catalog sc
    JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
    WHERE ut.name = 'VRV Outdoor';

  IF mxw_total <> 21 THEN
    RAISE EXCEPTION 'Expected 21 MNX Wall rows (7 services x 3 bands), found %', mxw_total;
  END IF;
  IF mxc_total <> 21 THEN
    RAISE EXCEPTION 'Expected 21 MNX Cassette/Duct rows (7 services x 3 bands), found %', mxc_total;
  END IF;
  IF mxo_total <> 21 THEN
    RAISE EXCEPTION 'Expected 21 MNX Outdoor rows (7 services x 3 bands), found %', mxo_total;
  END IF;
  IF vw_total <> 21 THEN
    RAISE EXCEPTION 'Expected 21 VRV Wall rows (7 services x 3 bands), found %', vw_total;
  END IF;
  IF vcd_total <> 52 THEN
    RAISE EXCEPTION 'Expected 52 VRV Cassette Ducting rows (13 services x 4 bands), found %', vcd_total;
  END IF;
  IF vo_total <> 52 THEN
    RAISE EXCEPTION 'Expected 52 VRV Outdoor rows (13 services x 4 bands), found %', vo_total;
  END IF;

  SELECT COUNT(*) INTO bad_active
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  WHERE ut.name IN ('MNX Wall','MNX Cassette/Duct','MNX Outdoor',
                    'VRV Wall','VRV Cassette Ducting','VRV Outdoor')
    AND (NOT sc.is_active OR sc.base_price <= 0);

  IF bad_active <> 0 THEN
    RAISE EXCEPTION 'Found % MNX/VRV rows that are inactive or non-positive priced (all should be active & priced)', bad_active;
  END IF;

  SELECT COUNT(DISTINCT st.code) INTO vcd_pg
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  JOIN public.service_types st ON st.service_type_id = sc.service_type_id
  WHERE ut.name = 'VRV Cassette Ducting'
    AND st.code IN ('PG_EL','PG_EV','PG_KO','PG_KD','PG_FM');

  SELECT COUNT(DISTINCT st.code) INTO vo_pg
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  JOIN public.service_types st ON st.service_type_id = sc.service_type_id
  WHERE ut.name = 'VRV Outdoor'
    AND st.code IN ('PG_EL','PG_EV','PG_KO','PG_KD','PG_FM');

  IF vcd_pg <> 5 THEN
    RAISE EXCEPTION 'Expected all 5 component-replacement codes on VRV Cassette Ducting, found %', vcd_pg;
  END IF;
  IF vo_pg <> 5 THEN
    RAISE EXCEPTION 'Expected all 5 component-replacement codes on VRV Outdoor, found %', vo_pg;
  END IF;

  SELECT COUNT(*) INTO vcd_pcek
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  JOIN public.service_types st ON st.service_type_id = sc.service_type_id
  WHERE ut.name = 'VRV Cassette Ducting' AND st.code = 'PCEK';

  SELECT COUNT(*) INTO vo_pcek
  FROM public.service_catalog sc
  JOIN public.unit_types ut ON ut.unit_type_id = sc.unit_type_id
  JOIN public.service_types st ON st.service_type_id = sc.service_type_id
  WHERE ut.name = 'VRV Outdoor' AND st.code = 'PCEK';

  IF vcd_pcek <> 4 THEN
    RAISE EXCEPTION 'Expected 4 PCEK rows on VRV Cassette Ducting (one per band), found %', vcd_pcek;
  END IF;
  IF vo_pcek <> 4 THEN
    RAISE EXCEPTION 'Expected 4 PCEK rows on VRV Outdoor (one per band), found %', vo_pcek;
  END IF;

  SELECT base_price INTO p_mxw_base FROM public.service_catalog WHERE msn_code = 'MXW-CHK-0.5-1.5';
  SELECT base_price INTO p_ra_base  FROM public.service_catalog WHERE msn_code = 'RA-CHK-0.5-1.5';
  SELECT base_price INTO p_vcd_base FROM public.service_catalog WHERE msn_code = 'VCD-CHK-8-12';
  SELECT base_price INTO p_vcd_14   FROM public.service_catalog WHERE msn_code = 'VCD-CHK-14-20';
  SELECT base_price INTO p_vcd_18   FROM public.service_catalog WHERE msn_code = 'VCD-CHK-18-40';
  SELECT base_price INTO p_vcd_42   FROM public.service_catalog WHERE msn_code = 'VCD-CHK-42-60';
  SELECT base_price INTO p_vcd_ko   FROM public.service_catalog WHERE msn_code = 'VCD-PG_KO-8-12';
  SELECT base_price INTO p_vcd_el   FROM public.service_catalog WHERE msn_code = 'VCD-PG_EL-8-12';
  SELECT base_price INTO p_vo_base  FROM public.service_catalog WHERE msn_code = 'VO-CHK-8-12';
  SELECT base_price INTO p_vo_ka    FROM public.service_catalog WHERE msn_code = 'VO-KA-8-12';

  IF p_mxw_base <> 85000 THEN
    RAISE EXCEPTION 'MXW-CHK-0.5-1.5 expected 85000, found %', p_mxw_base;
  END IF;
  IF p_mxw_base <= p_ra_base THEN
    RAISE EXCEPTION 'MNX Wall base (%) should exceed Room Air base (%)', p_mxw_base, p_ra_base;
  END IF;
  IF p_vcd_base <> 250000 THEN
    RAISE EXCEPTION 'VCD-CHK-8-12 expected 250000, found %', p_vcd_base;
  END IF;
  IF p_vo_ka <> 400000 THEN
    RAISE EXCEPTION 'VO-KA-8-12 expected 400000, found %', p_vo_ka;
  END IF;
  IF p_vcd_14 <= p_vcd_base OR p_vcd_18 <= p_vcd_14 OR p_vcd_42 <= p_vcd_18 THEN
    RAISE EXCEPTION 'VRV Cassette Ducting CHK prices must increase by band: 8-12=%, 14-20=%, 18-40=%, 42-60=%',
      p_vcd_base, p_vcd_14, p_vcd_18, p_vcd_42;
  END IF;
  IF p_vcd_42 < (p_vcd_base * 2) THEN
    RAISE EXCEPTION 'VCD 42-60 (%) expected ~2x the 8-12 base (%)', p_vcd_42, p_vcd_base;
  END IF;
  IF p_vcd_ko <= p_vcd_el THEN
    RAISE EXCEPTION 'Compressor replacement (% ) should be the most expensive part job vs electrical (%)', p_vcd_ko, p_vcd_el;
  END IF;
  IF p_vcd_base <= p_mxw_base THEN
    RAISE EXCEPTION 'VRV base (%) should far exceed MNX Wall base (%)', p_vcd_base, p_mxw_base;
  END IF;
  IF p_vo_base <> p_vcd_base THEN
    RAISE EXCEPTION 'VRV Outdoor base (%) expected to match VRV Cassette Ducting base (%)', p_vo_base, p_vcd_base;
  END IF;

  RAISE NOTICE 'OK: MNX (63) + VRV (125) seeded = 188 rows, idempotent, prices & component services verified.';
END $$;

ROLLBACK;
-- =============================================================================
-- End of test_03_seed_catalog_mnx_vrv.sql
-- =============================================================================
