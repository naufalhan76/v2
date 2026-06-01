-- =============================================================================
-- 03_seed_catalog_skyair_ahu.sql — Idempotent seed for service_catalog entries
-- -----------------------------------------------------------------------------
-- Seeds priced catalog rows for three unit types:
--   1. SkyAir Cassette (3 capacity bands x 8 service types = 24 rows)
--   2. AHU             (3 capacity bands x 8 service types = 24 rows)
--   3. Refrigerant     (4 weight-based bands x REFILL_FREON = 4 rows)
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
--   * SkyAir Cassette 0.5-2 HP is the base band; 2.5-5 HP ~30% above base;
--     6-8 HP ~60% above base.
--   * AHU is commercial equipment priced higher than residential units, scaling
--     up sharply with capacity (5-10 HP / 11-20 HP / 21-40 HP).
--   * Refrigerant top-up is priced by weight (Kg) via the REFILL_FREON service.
--   * Service categories with no standard price (PCEK / PENGECEKAN) are seeded
--     with base_price = 0 and is_active = FALSE so they stay invisible to order
--     autofill while still existing for future configuration.
--
-- Re-running this migration produces no errors and inserts no duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SKYAIR CASSETTE
--    unit_type resolved via CTE; service_type via code; capacity via label.
--    PCEK has no standard price -> base_price 0, inactive (hidden from autofill).
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'SkyAir Cassette'
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
  -- capacity band: 0.5-2 HP (base prices)
  ('SC-CHK-0.5-2',   '0.5-2 HP', 'CHK',    'SkyAir Cassette Checking 0.5-2 HP',         125000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SC-KA-0.5-2',    '0.5-2 HP', 'KA',     'SkyAir Cassette Kategori A 0.5-2 HP',       225000, ARRAY['Servis ringan','Pembersihan filter cassette']::text[], TRUE),
  ('SC-KB-0.5-2',    '0.5-2 HP', 'KB',     'SkyAir Cassette Kategori B 0.5-2 HP',       300000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SC-KC-0.5-2',    '0.5-2 HP', 'KC',     'SkyAir Cassette Kategori C 0.5-2 HP',       400000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SC-KD-0.5-2',    '0.5-2 HP', 'KD',     'SkyAir Cassette Kategori D 0.5-2 HP',       500000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SC-CLMIN-0.5-2', '0.5-2 HP', 'CL_MIN', 'SkyAir Cassette Cleaning Minor 0.5-2 HP',   100000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('SC-CLMAJ-0.5-2', '0.5-2 HP', 'CL_MAJ', 'SkyAir Cassette Cleaning Major 0.5-2 HP',   175000, ARRAY['Pembersihan menyeluruh','Bongkar pasang panel cassette']::text[], TRUE),
  ('SC-PCEK-0.5-2',  '0.5-2 HP', 'PCEK',   'SkyAir Cassette Pengecekan 0.5-2 HP',       0,      NULL::text[], FALSE),
  -- capacity band: 2.5-5 HP (~30% above base)
  ('SC-CHK-2.5-5',   '2.5-5 HP', 'CHK',    'SkyAir Cassette Checking 2.5-5 HP',         160000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SC-KA-2.5-5',    '2.5-5 HP', 'KA',     'SkyAir Cassette Kategori A 2.5-5 HP',       290000, ARRAY['Servis ringan','Pembersihan filter cassette']::text[], TRUE),
  ('SC-KB-2.5-5',    '2.5-5 HP', 'KB',     'SkyAir Cassette Kategori B 2.5-5 HP',       390000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SC-KC-2.5-5',    '2.5-5 HP', 'KC',     'SkyAir Cassette Kategori C 2.5-5 HP',       520000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SC-KD-2.5-5',    '2.5-5 HP', 'KD',     'SkyAir Cassette Kategori D 2.5-5 HP',       650000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SC-CLMIN-2.5-5', '2.5-5 HP', 'CL_MIN', 'SkyAir Cassette Cleaning Minor 2.5-5 HP',   130000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('SC-CLMAJ-2.5-5', '2.5-5 HP', 'CL_MAJ', 'SkyAir Cassette Cleaning Major 2.5-5 HP',   225000, ARRAY['Pembersihan menyeluruh','Bongkar pasang panel cassette']::text[], TRUE),
  ('SC-PCEK-2.5-5',  '2.5-5 HP', 'PCEK',   'SkyAir Cassette Pengecekan 2.5-5 HP',       0,      NULL::text[], FALSE),
  -- capacity band: 6-8 HP (~60% above base)
  ('SC-CHK-6-8',     '6-8 HP',   'CHK',    'SkyAir Cassette Checking 6-8 HP',           200000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SC-KA-6-8',      '6-8 HP',   'KA',     'SkyAir Cassette Kategori A 6-8 HP',         360000, ARRAY['Servis ringan','Pembersihan filter cassette']::text[], TRUE),
  ('SC-KB-6-8',      '6-8 HP',   'KB',     'SkyAir Cassette Kategori B 6-8 HP',         480000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SC-KC-6-8',      '6-8 HP',   'KC',     'SkyAir Cassette Kategori C 6-8 HP',         640000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SC-KD-6-8',      '6-8 HP',   'KD',     'SkyAir Cassette Kategori D 6-8 HP',         800000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SC-CLMIN-6-8',   '6-8 HP',   'CL_MIN', 'SkyAir Cassette Cleaning Minor 6-8 HP',     160000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('SC-CLMAJ-6-8',   '6-8 HP',   'CL_MAJ', 'SkyAir Cassette Cleaning Major 6-8 HP',     280000, ARRAY['Pembersihan menyeluruh','Bongkar pasang panel cassette']::text[], TRUE),
  ('SC-PCEK-6-8',    '6-8 HP',   'PCEK',   'SkyAir Cassette Pengecekan 6-8 HP',         0,      NULL::text[], FALSE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. AHU (AIR HANDLING UNIT)
--    Commercial equipment — priced higher than residential units and scaling
--    sharply with capacity. unit_type via CTE; service_type via code; capacity
--    via label. PCEK has no standard price -> base_price 0, inactive.
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'AHU'
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
  -- capacity band: 5-10 HP (base commercial prices)
  ('AHU-CHK-5-10',    '5-10 HP', 'CHK',    'AHU Checking 5-10 HP',         200000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja blower & coil']::text[], TRUE),
  ('AHU-KA-5-10',     '5-10 HP', 'KA',     'AHU Kategori A 5-10 HP',       400000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('AHU-KB-5-10',     '5-10 HP', 'KB',     'AHU Kategori B 5-10 HP',       550000,  ARRAY['Servis sedang','Pembersihan coil']::text[], TRUE),
  ('AHU-KC-5-10',     '5-10 HP', 'KC',     'AHU Kategori C 5-10 HP',       750000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('AHU-KD-5-10',     '5-10 HP', 'KD',     'AHU Kategori D 5-10 HP',       950000,  ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('AHU-CLMIN-5-10',  '5-10 HP', 'CL_MIN', 'AHU Cleaning Minor 5-10 HP',   300000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('AHU-CLMAJ-5-10',  '5-10 HP', 'CL_MAJ', 'AHU Cleaning Major 5-10 HP',   500000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang coil & blower']::text[], TRUE),
  ('AHU-PCEK-5-10',   '5-10 HP', 'PCEK',   'AHU Pengecekan 5-10 HP',       0,       NULL::text[], FALSE),
  -- capacity band: 11-20 HP
  ('AHU-CHK-11-20',   '11-20 HP', 'CHK',    'AHU Checking 11-20 HP',       350000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja blower & coil']::text[], TRUE),
  ('AHU-KA-11-20',    '11-20 HP', 'KA',     'AHU Kategori A 11-20 HP',     650000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('AHU-KB-11-20',    '11-20 HP', 'KB',     'AHU Kategori B 11-20 HP',     900000,  ARRAY['Servis sedang','Pembersihan coil']::text[], TRUE),
  ('AHU-KC-11-20',    '11-20 HP', 'KC',     'AHU Kategori C 11-20 HP',     1200000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('AHU-KD-11-20',    '11-20 HP', 'KD',     'AHU Kategori D 11-20 HP',     1500000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('AHU-CLMIN-11-20', '11-20 HP', 'CL_MIN', 'AHU Cleaning Minor 11-20 HP', 500000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('AHU-CLMAJ-11-20', '11-20 HP', 'CL_MAJ', 'AHU Cleaning Major 11-20 HP', 850000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang coil & blower']::text[], TRUE),
  ('AHU-PCEK-11-20',  '11-20 HP', 'PCEK',   'AHU Pengecekan 11-20 HP',     0,       NULL::text[], FALSE),
  -- capacity band: 21-40 HP
  ('AHU-CHK-21-40',   '21-40 HP', 'CHK',    'AHU Checking 21-40 HP',       600000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja blower & coil']::text[], TRUE),
  ('AHU-KA-21-40',    '21-40 HP', 'KA',     'AHU Kategori A 21-40 HP',     1100000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('AHU-KB-21-40',    '21-40 HP', 'KB',     'AHU Kategori B 21-40 HP',     1500000, ARRAY['Servis sedang','Pembersihan coil']::text[], TRUE),
  ('AHU-KC-21-40',    '21-40 HP', 'KC',     'AHU Kategori C 21-40 HP',     2000000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('AHU-KD-21-40',    '21-40 HP', 'KD',     'AHU Kategori D 21-40 HP',     2500000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('AHU-CLMIN-21-40', '21-40 HP', 'CL_MIN', 'AHU Cleaning Minor 21-40 HP', 850000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('AHU-CLMAJ-21-40', '21-40 HP', 'CL_MAJ', 'AHU Cleaning Major 21-40 HP', 1400000, ARRAY['Pembersihan menyeluruh','Bongkar pasang coil & blower']::text[], TRUE),
  ('AHU-PCEK-21-40',  '21-40 HP', 'PCEK',   'AHU Pengecekan 21-40 HP',     0,       NULL::text[], FALSE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. REFRIGERANT (weight-based top-up via REFILL_FREON)
--    Priced by refrigerant weight (Kg) rather than HP. Single service type
--    (REFILL_FREON). unit_type via CTE; service_type via code; capacity via
--    weight label. ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'Refrigerant'
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
  ('REF-REFILL-0.5KG', '0.5 Kg', 'REFILL_FREON', 'Refrigerant Refill 0.5 Kg', 150000, ARRAY['Pengisian freon 0.5 Kg','Cek kebocoran','Cek tekanan akhir']::text[], TRUE),
  ('REF-REFILL-1KG',   '1 Kg',   'REFILL_FREON', 'Refrigerant Refill 1 Kg',   250000, ARRAY['Pengisian freon 1 Kg','Cek kebocoran','Cek tekanan akhir']::text[], TRUE),
  ('REF-REFILL-2KG',   '2 Kg',   'REFILL_FREON', 'Refrigerant Refill 2 Kg',   400000, ARRAY['Pengisian freon 2 Kg','Cek kebocoran','Cek tekanan akhir']::text[], TRUE),
  ('REF-REFILL-5KG',   '5 Kg',   'REFILL_FREON', 'Refrigerant Refill 5 Kg',   800000, ARRAY['Pengisian freon 5 Kg','Cek kebocoran','Cek tekanan akhir']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- =============================================================================
-- End of 03_seed_catalog_skyair_ahu.sql
-- =============================================================================
