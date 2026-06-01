-- =============================================================================
-- 03_seed_catalog_room_air.sql — Idempotent seed for service_catalog entries
-- -----------------------------------------------------------------------------
-- Seeds priced catalog rows for two unit types:
--   1. Room Air      (3 capacity bands x 7 service types = 21 rows)
--   2. Air Purifier  (single capacity band x 7 service types = 7 rows)
--
-- Dimension IDs are resolved via name/code lookups against the dimension tables
-- seeded in 02_seed_dimensions.sql. No hardcoded UUIDs are used: a CTE resolves
-- the unit_type, and JOINs resolve service_type (by code) and capacity_range
-- (by unit_type_id + capacity_label).
--
-- Idempotency:
--   * service_catalog -> ON CONFLICT (msn_code) DO NOTHING  (msn_code is UNIQUE)
--
-- FK safety:
--   * Rows are produced by INNER JOINs against the dimension tables, so if a
--     referenced dimension is missing the row is simply not emitted — never
--     inserted with a dangling/invalid foreign key.
--
-- Pricing model (IDR, Indonesian AC service market):
--   * Room Air 0.5-1.5 HP is the base band.
--   * Room Air 2-2.5 HP is ~25% above base.
--   * Room Air 3 HP is ~50% above base.
--   * Air Purifier is a smaller unit with lower prices.
--   * Service categories with no standard price in the source schema are seeded
--     with base_price = 0 and is_active = FALSE so they stay invisible to order
--     autofill while still existing for future configuration.
--
-- Re-running this migration produces no errors and inserts no duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ROOM AIR
--    unit_type resolved via CTE; service_type via code; capacity via label.
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'Room Air'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code,
  ut.unit_type_id,
  cr.capacity_id,
  st.service_type_id,
  v.service_name,
  v.base_price,
  v.includes,
  v.is_active
FROM ut
CROSS JOIN (VALUES
  -- capacity band: 0.5-1.5 HP (base prices)
  ('RA-CHK-0.5-1.5',   '0.5-1.5 HP', 'CHK',    'Room Air Checking 0.5-1.5 HP',         75000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('RA-KA-0.5-1.5',    '0.5-1.5 HP', 'KA',     'Room Air Kategori A 0.5-1.5 HP',       150000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('RA-KB-0.5-1.5',    '0.5-1.5 HP', 'KB',     'Room Air Kategori B 0.5-1.5 HP',       200000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('RA-KC-0.5-1.5',    '0.5-1.5 HP', 'KC',     'Room Air Kategori C 0.5-1.5 HP',       275000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('RA-KD-0.5-1.5',    '0.5-1.5 HP', 'KD',     'Room Air Kategori D 0.5-1.5 HP',       350000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('RA-CLMIN-0.5-1.5', '0.5-1.5 HP', 'CL_MIN', 'Room Air Cleaning Minor 0.5-1.5 HP',   100000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('RA-CLMAJ-0.5-1.5', '0.5-1.5 HP', 'CL_MAJ', 'Room Air Cleaning Major 0.5-1.5 HP',   175000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- capacity band: 2-2.5 HP (~25% above base)
  ('RA-CHK-2-2.5',     '2-2.5 HP',   'CHK',    'Room Air Checking 2-2.5 HP',           95000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('RA-KA-2-2.5',      '2-2.5 HP',   'KA',     'Room Air Kategori A 2-2.5 HP',         190000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('RA-KB-2-2.5',      '2-2.5 HP',   'KB',     'Room Air Kategori B 2-2.5 HP',         255000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('RA-KC-2-2.5',      '2-2.5 HP',   'KC',     'Room Air Kategori C 2-2.5 HP',         350000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('RA-KD-2-2.5',      '2-2.5 HP',   'KD',     'Room Air Kategori D 2-2.5 HP',         445000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('RA-CLMIN-2-2.5',   '2-2.5 HP',   'CL_MIN', 'Room Air Cleaning Minor 2-2.5 HP',     130000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('RA-CLMAJ-2-2.5',   '2-2.5 HP',   'CL_MAJ', 'Room Air Cleaning Major 2-2.5 HP',     225000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- capacity band: 3 HP (~50% above base)
  ('RA-CHK-3',         '3 HP',       'CHK',    'Room Air Checking 3 HP',               115000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('RA-KA-3',          '3 HP',       'KA',     'Room Air Kategori A 3 HP',             225000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('RA-KB-3',          '3 HP',       'KB',     'Room Air Kategori B 3 HP',             300000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('RA-KC-3',          '3 HP',       'KC',     'Room Air Kategori C 3 HP',             410000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('RA-KD-3',          '3 HP',       'KD',     'Room Air Kategori D 3 HP',             525000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('RA-CLMIN-3',       '3 HP',       'CL_MIN', 'Room Air Cleaning Minor 3 HP',         150000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('RA-CLMAJ-3',       '3 HP',       'CL_MAJ', 'Room Air Cleaning Major 3 HP',         265000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. AIR PURIFIER
--    Single capacity band ('All Capacities'). Only CHK / CL_MIN / CL_MAJ carry
--    standard prices; the remaining service categories have no published price
--    in the source schema and are seeded with base_price = 0, is_active = FALSE
--    so they stay invisible to order autofill.
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'Air Purifier'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code,
  ut.unit_type_id,
  cr.capacity_id,
  st.service_type_id,
  v.service_name,
  v.base_price,
  v.includes,
  v.is_active
FROM ut
CROSS JOIN (VALUES
  -- priced services
  ('AP-CHK',    'All Capacities', 'CHK',    'Air Purifier Checking',        65000,  ARRAY['Pemeriksaan unit','Cek kelistrikan','Cek kinerja filtrasi']::text[], TRUE),
  ('AP-CLMIN',  'All Capacities', 'CL_MIN', 'Air Purifier Cleaning Minor',  85000,  ARRAY['Pembersihan pre-filter','Pembersihan housing']::text[], TRUE),
  ('AP-CLMAJ',  'All Capacities', 'CL_MAJ', 'Air Purifier Cleaning Major',  125000, ARRAY['Pembersihan menyeluruh','Penggantian filter (jika perlu)']::text[], TRUE),
  -- no standard price in source schema -> base_price 0, inactive (hidden from autofill)
  ('AP-KA',     'All Capacities', 'KA',     'Air Purifier Kategori A',      0,      NULL::text[], FALSE),
  ('AP-KB',     'All Capacities', 'KB',     'Air Purifier Kategori B',      0,      NULL::text[], FALSE),
  ('AP-KC',     'All Capacities', 'KC',     'Air Purifier Kategori C',      0,      NULL::text[], FALSE),
  ('AP-KD',     'All Capacities', 'KD',     'Air Purifier Kategori D',      0,      NULL::text[], FALSE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- =============================================================================
-- End of 03_seed_catalog_room_air.sql
-- =============================================================================
