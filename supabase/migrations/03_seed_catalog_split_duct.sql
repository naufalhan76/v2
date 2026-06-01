-- =============================================================================
-- 03_seed_catalog_split_duct.sql — Idempotent seed for service_catalog entries
-- -----------------------------------------------------------------------------
-- Seeds priced catalog rows for two larger unit types:
--   1. Split Duct      (3 capacity bands x 7 service types = 21 rows)
--   2. Standing Floor  (2 capacity bands x 7 service types = 14 rows)
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
--   * Split Duct and Standing Floor are larger units, so prices sit above the
--     Room Air bands seeded in 03_seed_catalog_room_air.sql.
--   * Split Duct 2-3 HP is the Split Duct base band.
--   * Split Duct 4-5 HP is ~30% above the Split Duct base band.
--   * Split Duct 6-8 HP is ~50% above the Split Duct base band.
--   * Standing Floor sits in a similar range but slightly higher than Split Duct.
--   * Standing Floor 3-5 HP is the Standing Floor base band.
--   * Standing Floor 6-10 HP is ~50% above the Standing Floor base band.
--   * Cleaning categories (CL_MIN / CL_MAJ) carry no standard published price for
--     these unit types, so they are seeded with base_price = 0 and
--     is_active = FALSE: they stay invisible to order autofill while still
--     existing for future configuration.
--
-- Re-running this migration produces no errors and inserts no duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SPLIT DUCT
--    unit_type resolved via CTE; service_type via code; capacity via label.
--    CHK / KA / KB / KC / KD carry estimated prices (active).
--    CL_MIN / CL_MAJ have no published price -> base_price 0, is_active FALSE.
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'Split Duct'
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
  -- capacity band: 2-3 HP (base prices)
  ('SD-CHK-2-3',     '2-3 HP', 'CHK',    'Split Duct Checking 2-3 HP',         125000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SD-KA-2-3',      '2-3 HP', 'KA',     'Split Duct Kategori A 2-3 HP',       225000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('SD-KB-2-3',      '2-3 HP', 'KB',     'Split Duct Kategori B 2-3 HP',       300000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SD-KC-2-3',      '2-3 HP', 'KC',     'Split Duct Kategori C 2-3 HP',       400000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SD-KD-2-3',      '2-3 HP', 'KD',     'Split Duct Kategori D 2-3 HP',       500000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SD-CLMIN-2-3',   '2-3 HP', 'CL_MIN', 'Split Duct Cleaning Minor 2-3 HP',   0,      NULL::text[], FALSE),
  ('SD-CLMAJ-2-3',   '2-3 HP', 'CL_MAJ', 'Split Duct Cleaning Major 2-3 HP',   0,      NULL::text[], FALSE),
  -- capacity band: 4-5 HP (~30% above base)
  ('SD-CHK-4-5',     '4-5 HP', 'CHK',    'Split Duct Checking 4-5 HP',         162500, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SD-KA-4-5',      '4-5 HP', 'KA',     'Split Duct Kategori A 4-5 HP',       292500, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('SD-KB-4-5',      '4-5 HP', 'KB',     'Split Duct Kategori B 4-5 HP',       390000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SD-KC-4-5',      '4-5 HP', 'KC',     'Split Duct Kategori C 4-5 HP',       520000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SD-KD-4-5',      '4-5 HP', 'KD',     'Split Duct Kategori D 4-5 HP',       650000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SD-CLMIN-4-5',   '4-5 HP', 'CL_MIN', 'Split Duct Cleaning Minor 4-5 HP',   0,      NULL::text[], FALSE),
  ('SD-CLMAJ-4-5',   '4-5 HP', 'CL_MAJ', 'Split Duct Cleaning Major 4-5 HP',   0,      NULL::text[], FALSE),
  -- capacity band: 6-8 HP (~50% above base)
  ('SD-CHK-6-8',     '6-8 HP', 'CHK',    'Split Duct Checking 6-8 HP',         187500, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SD-KA-6-8',      '6-8 HP', 'KA',     'Split Duct Kategori A 6-8 HP',       337500, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('SD-KB-6-8',      '6-8 HP', 'KB',     'Split Duct Kategori B 6-8 HP',       450000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SD-KC-6-8',      '6-8 HP', 'KC',     'Split Duct Kategori C 6-8 HP',       600000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SD-KD-6-8',      '6-8 HP', 'KD',     'Split Duct Kategori D 6-8 HP',       750000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SD-CLMIN-6-8',   '6-8 HP', 'CL_MIN', 'Split Duct Cleaning Minor 6-8 HP',   0,      NULL::text[], FALSE),
  ('SD-CLMAJ-6-8',   '6-8 HP', 'CL_MAJ', 'Split Duct Cleaning Major 6-8 HP',   0,      NULL::text[], FALSE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. STANDING FLOOR
--    unit_type resolved via CTE; service_type via code; capacity via label.
--    CHK / KA / KB / KC / KD carry estimated prices (active), slightly higher
--    than the matching Split Duct band.
--    CL_MIN / CL_MAJ have no published price -> base_price 0, is_active FALSE.
--    ON CONFLICT (msn_code) DO NOTHING for idempotency.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'Standing Floor'
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
  -- capacity band: 3-5 HP (base prices, slightly above Split Duct base)
  ('SF-CHK-3-5',     '3-5 HP',  'CHK',    'Standing Floor Checking 3-5 HP',         140000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SF-KA-3-5',      '3-5 HP',  'KA',     'Standing Floor Kategori A 3-5 HP',       250000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('SF-KB-3-5',      '3-5 HP',  'KB',     'Standing Floor Kategori B 3-5 HP',       330000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SF-KC-3-5',      '3-5 HP',  'KC',     'Standing Floor Kategori C 3-5 HP',       440000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SF-KD-3-5',      '3-5 HP',  'KD',     'Standing Floor Kategori D 3-5 HP',       550000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SF-CLMIN-3-5',   '3-5 HP',  'CL_MIN', 'Standing Floor Cleaning Minor 3-5 HP',   0,      NULL::text[], FALSE),
  ('SF-CLMAJ-3-5',   '3-5 HP',  'CL_MAJ', 'Standing Floor Cleaning Major 3-5 HP',   0,      NULL::text[], FALSE),
  -- capacity band: 6-10 HP (~50% above Standing Floor base)
  ('SF-CHK-6-10',    '6-10 HP', 'CHK',    'Standing Floor Checking 6-10 HP',        210000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('SF-KA-6-10',     '6-10 HP', 'KA',     'Standing Floor Kategori A 6-10 HP',      375000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('SF-KB-6-10',     '6-10 HP', 'KB',     'Standing Floor Kategori B 6-10 HP',      495000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('SF-KC-6-10',     '6-10 HP', 'KC',     'Standing Floor Kategori C 6-10 HP',      660000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('SF-KD-6-10',     '6-10 HP', 'KD',     'Standing Floor Kategori D 6-10 HP',      825000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('SF-CLMIN-6-10',  '6-10 HP', 'CL_MIN', 'Standing Floor Cleaning Minor 6-10 HP',  0,      NULL::text[], FALSE),
  ('SF-CLMAJ-6-10',  '6-10 HP', 'CL_MAJ', 'Standing Floor Cleaning Major 6-10 HP',  0,      NULL::text[], FALSE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- =============================================================================
-- End of 03_seed_catalog_split_duct.sql
-- =============================================================================
