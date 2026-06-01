-- =============================================================================
-- 03_seed_catalog_mnx_vrv.sql — Idempotent seed for MNX + VRV catalog entries
-- -----------------------------------------------------------------------------
-- Seeds priced service_catalog rows for the six "mini-VRV" (MNX) and full
-- VRV/VRF unit types seeded in 02_seed_dimensions.sql:
--   1. MNX Wall             (3 bands x 7 service types)
--   2. MNX Cassette/Duct    (3 bands x 7 service types)
--   3. MNX Outdoor          (3 bands x 7 service types)
--   4. VRV Wall             (3 bands x 7 service types)
--   5. VRV Cassette Ducting (4 bands x 13 service types -> incl. PCEK + PG_*)
--   6. VRV Outdoor          (4 bands x 13 service types -> incl. PCEK + PG_*)
--
-- Dimension IDs are resolved via name/code lookups against the dimension tables.
-- No hardcoded UUIDs: a CTE resolves the unit_type, and JOINs resolve
-- service_type (by code) and capacity_range (by unit_type_id + capacity_label).
--
-- Idempotency:
--   * service_catalog -> ON CONFLICT (msn_code) DO NOTHING  (msn_code is UNIQUE)
--
-- FK safety:
--   * Rows are produced by INNER JOINs against the dimension tables, so a
--     missing referenced dimension simply drops the row — never inserts a
--     dangling/invalid foreign key.
--
-- Pricing model (IDR, Indonesian AC service market):
--   * MNX (mini-VRV) sits between Room Air and full VRV.
--       - MNX Wall    : Room Air pricing + ~15% premium.
--       - MNX Cassette/Duct / MNX Outdoor : comparable to small VRV work.
--   * VRV (large commercial) pricing is significantly higher and scales by band:
--       - 8-12 HP = base, 14-20 HP ~ +30%, 18-40 HP ~ +60%, 42-60 HP ~ +100%.
--       (VRV Wall bands 0.8-1.5 / 2-2.5 / 3-4 HP use the small-indoor curve.)
--   * Component-replacement service fees (PG_*) scale with the same band factor;
--       compressor (PG_KO) is by far the most expensive part-bearing job. These
--       are the service/labour fees — physical parts are billed via addons.
--   * msn_code uses CLMIN/CLMAJ as short labels for the CL_MIN/CL_MAJ codes,
--       mirroring the Room Air seed convention.
--
-- Re-running this migration produces no errors and inserts no duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MNX WALL  (prefix MXW)  — Room Air pricing + ~15% premium.
--    Bands: 0.5-1.5 HP (base), 2-2.5 HP (~25% up), 3 HP (~50% up).
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'MNX Wall'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 0.5-1.5 HP (base)
  ('MXW-CHK-0.5-1.5',   '0.5-1.5 HP', 'CHK',    'MNX Wall Checking 0.5-1.5 HP',       85000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXW-KA-0.5-1.5',    '0.5-1.5 HP', 'KA',     'MNX Wall Kategori A 0.5-1.5 HP',     175000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXW-KB-0.5-1.5',    '0.5-1.5 HP', 'KB',     'MNX Wall Kategori B 0.5-1.5 HP',     230000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXW-KC-0.5-1.5',    '0.5-1.5 HP', 'KC',     'MNX Wall Kategori C 0.5-1.5 HP',     315000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXW-KD-0.5-1.5',    '0.5-1.5 HP', 'KD',     'MNX Wall Kategori D 0.5-1.5 HP',     400000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXW-CLMIN-0.5-1.5', '0.5-1.5 HP', 'CL_MIN', 'MNX Wall Cleaning Minor 0.5-1.5 HP', 115000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXW-CLMAJ-0.5-1.5', '0.5-1.5 HP', 'CL_MAJ', 'MNX Wall Cleaning Major 0.5-1.5 HP', 200000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 2-2.5 HP (~25% up)
  ('MXW-CHK-2-2.5',     '2-2.5 HP',   'CHK',    'MNX Wall Checking 2-2.5 HP',         110000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXW-KA-2-2.5',      '2-2.5 HP',   'KA',     'MNX Wall Kategori A 2-2.5 HP',       220000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXW-KB-2-2.5',      '2-2.5 HP',   'KB',     'MNX Wall Kategori B 2-2.5 HP',       290000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXW-KC-2-2.5',      '2-2.5 HP',   'KC',     'MNX Wall Kategori C 2-2.5 HP',       395000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXW-KD-2-2.5',      '2-2.5 HP',   'KD',     'MNX Wall Kategori D 2-2.5 HP',       500000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXW-CLMIN-2-2.5',   '2-2.5 HP',   'CL_MIN', 'MNX Wall Cleaning Minor 2-2.5 HP',   145000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXW-CLMAJ-2-2.5',   '2-2.5 HP',   'CL_MAJ', 'MNX Wall Cleaning Major 2-2.5 HP',   250000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 3 HP (~50% up)
  ('MXW-CHK-3',         '3 HP',       'CHK',    'MNX Wall Checking 3 HP',             130000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXW-KA-3',          '3 HP',       'KA',     'MNX Wall Kategori A 3 HP',           260000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXW-KB-3',          '3 HP',       'KB',     'MNX Wall Kategori B 3 HP',           345000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXW-KC-3',          '3 HP',       'KC',     'MNX Wall Kategori C 3 HP',           470000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXW-KD-3',          '3 HP',       'KD',     'MNX Wall Kategori D 3 HP',           600000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXW-CLMIN-3',       '3 HP',       'CL_MIN', 'MNX Wall Cleaning Minor 3 HP',       170000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXW-CLMAJ-3',       '3 HP',       'CL_MAJ', 'MNX Wall Cleaning Major 3 HP',       295000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. MNX CASSETTE/DUCT  (prefix MXC)  — comparable to small VRV cassette work.
--    Bands: 2-3 HP (base), 4-5 HP (~30% up), 6-8 HP (~60% up).
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'MNX Cassette/Duct'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 2-3 HP (base)
  ('MXC-CHK-2-3',     '2-3 HP', 'CHK',    'MNX Cassette/Duct Checking 2-3 HP',       175000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXC-KA-2-3',      '2-3 HP', 'KA',     'MNX Cassette/Duct Kategori A 2-3 HP',     350000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXC-KB-2-3',      '2-3 HP', 'KB',     'MNX Cassette/Duct Kategori B 2-3 HP',     460000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXC-KC-2-3',      '2-3 HP', 'KC',     'MNX Cassette/Duct Kategori C 2-3 HP',     600000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXC-KD-2-3',      '2-3 HP', 'KD',     'MNX Cassette/Duct Kategori D 2-3 HP',     750000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXC-CLMIN-2-3',   '2-3 HP', 'CL_MIN', 'MNX Cassette/Duct Cleaning Minor 2-3 HP', 250000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXC-CLMAJ-2-3',   '2-3 HP', 'CL_MAJ', 'MNX Cassette/Duct Cleaning Major 2-3 HP', 400000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 4-5 HP (~30% up)
  ('MXC-CHK-4-5',     '4-5 HP', 'CHK',    'MNX Cassette/Duct Checking 4-5 HP',       225000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXC-KA-4-5',      '4-5 HP', 'KA',     'MNX Cassette/Duct Kategori A 4-5 HP',     455000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXC-KB-4-5',      '4-5 HP', 'KB',     'MNX Cassette/Duct Kategori B 4-5 HP',     600000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXC-KC-4-5',      '4-5 HP', 'KC',     'MNX Cassette/Duct Kategori C 4-5 HP',     780000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXC-KD-4-5',      '4-5 HP', 'KD',     'MNX Cassette/Duct Kategori D 4-5 HP',     975000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXC-CLMIN-4-5',   '4-5 HP', 'CL_MIN', 'MNX Cassette/Duct Cleaning Minor 4-5 HP', 325000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXC-CLMAJ-4-5',   '4-5 HP', 'CL_MAJ', 'MNX Cassette/Duct Cleaning Major 4-5 HP', 520000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 6-8 HP (~60% up)
  ('MXC-CHK-6-8',     '6-8 HP', 'CHK',    'MNX Cassette/Duct Checking 6-8 HP',       280000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('MXC-KA-6-8',      '6-8 HP', 'KA',     'MNX Cassette/Duct Kategori A 6-8 HP',     560000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('MXC-KB-6-8',      '6-8 HP', 'KB',     'MNX Cassette/Duct Kategori B 6-8 HP',     735000,  ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('MXC-KC-6-8',      '6-8 HP', 'KC',     'MNX Cassette/Duct Kategori C 6-8 HP',     960000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXC-KD-6-8',      '6-8 HP', 'KD',     'MNX Cassette/Duct Kategori D 6-8 HP',     1200000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXC-CLMIN-6-8',   '6-8 HP', 'CL_MIN', 'MNX Cassette/Duct Cleaning Minor 6-8 HP', 400000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('MXC-CLMAJ-6-8',   '6-8 HP', 'CL_MAJ', 'MNX Cassette/Duct Cleaning Major 6-8 HP', 640000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. MNX OUTDOOR  (prefix MXO)  — comparable to small VRV outdoor condensing.
--    Bands: 4-6 HP (base), 8-10 HP (~35% up), 12-16 HP (~70% up).
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'MNX Outdoor'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 4-6 HP (base)
  ('MXO-CHK-4-6',     '4-6 HP', 'CHK',    'MNX Outdoor Checking 4-6 HP',       200000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('MXO-KA-4-6',      '4-6 HP', 'KA',     'MNX Outdoor Kategori A 4-6 HP',     400000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('MXO-KB-4-6',      '4-6 HP', 'KB',     'MNX Outdoor Kategori B 4-6 HP',     525000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('MXO-KC-4-6',      '4-6 HP', 'KC',     'MNX Outdoor Kategori C 4-6 HP',     685000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXO-KD-4-6',      '4-6 HP', 'KD',     'MNX Outdoor Kategori D 4-6 HP',     850000,  ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXO-CLMIN-4-6',   '4-6 HP', 'CL_MIN', 'MNX Outdoor Cleaning Minor 4-6 HP', 285000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('MXO-CLMAJ-4-6',   '4-6 HP', 'CL_MAJ', 'MNX Outdoor Cleaning Major 4-6 HP', 460000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  -- band: 8-10 HP (~35% up)
  ('MXO-CHK-8-10',    '8-10 HP', 'CHK',    'MNX Outdoor Checking 8-10 HP',       270000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('MXO-KA-8-10',     '8-10 HP', 'KA',     'MNX Outdoor Kategori A 8-10 HP',     540000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('MXO-KB-8-10',     '8-10 HP', 'KB',     'MNX Outdoor Kategori B 8-10 HP',     710000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('MXO-KC-8-10',     '8-10 HP', 'KC',     'MNX Outdoor Kategori C 8-10 HP',     925000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXO-KD-8-10',     '8-10 HP', 'KD',     'MNX Outdoor Kategori D 8-10 HP',     1150000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXO-CLMIN-8-10',  '8-10 HP', 'CL_MIN', 'MNX Outdoor Cleaning Minor 8-10 HP', 385000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('MXO-CLMAJ-8-10',  '8-10 HP', 'CL_MAJ', 'MNX Outdoor Cleaning Major 8-10 HP', 620000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  -- band: 12-16 HP (~70% up)
  ('MXO-CHK-12-16',   '12-16 HP', 'CHK',    'MNX Outdoor Checking 12-16 HP',       340000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('MXO-KA-12-16',    '12-16 HP', 'KA',     'MNX Outdoor Kategori A 12-16 HP',     680000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('MXO-KB-12-16',    '12-16 HP', 'KB',     'MNX Outdoor Kategori B 12-16 HP',     895000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('MXO-KC-12-16',    '12-16 HP', 'KC',     'MNX Outdoor Kategori C 12-16 HP',     1165000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('MXO-KD-12-16',    '12-16 HP', 'KD',     'MNX Outdoor Kategori D 12-16 HP',     1450000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('MXO-CLMIN-12-16', '12-16 HP', 'CL_MIN', 'MNX Outdoor Cleaning Minor 12-16 HP', 485000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('MXO-CLMAJ-12-16', '12-16 HP', 'CL_MAJ', 'MNX Outdoor Cleaning Major 12-16 HP', 780000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. VRV WALL  (prefix VW)  — small VRV/VRF indoor wall units.
--    Bands: 0.8-1.5 HP (base), 2-2.5 HP (~25% up), 3-4 HP (~55% up).
--    Priced above MNX Wall (genuine VRF indoor, brand premium).
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'VRV Wall'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 0.8-1.5 HP (base)
  ('VW-CHK-0.8-1.5',   '0.8-1.5 HP', 'CHK',    'VRV Wall Checking 0.8-1.5 HP',       110000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('VW-KA-0.8-1.5',    '0.8-1.5 HP', 'KA',     'VRV Wall Kategori A 0.8-1.5 HP',     220000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VW-KB-0.8-1.5',    '0.8-1.5 HP', 'KB',     'VRV Wall Kategori B 0.8-1.5 HP',     290000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VW-KC-0.8-1.5',    '0.8-1.5 HP', 'KC',     'VRV Wall Kategori C 0.8-1.5 HP',     380000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VW-KD-0.8-1.5',    '0.8-1.5 HP', 'KD',     'VRV Wall Kategori D 0.8-1.5 HP',     475000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VW-CLMIN-0.8-1.5', '0.8-1.5 HP', 'CL_MIN', 'VRV Wall Cleaning Minor 0.8-1.5 HP', 150000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VW-CLMAJ-0.8-1.5', '0.8-1.5 HP', 'CL_MAJ', 'VRV Wall Cleaning Major 0.8-1.5 HP', 260000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 2-2.5 HP (~25% up)
  ('VW-CHK-2-2.5',     '2-2.5 HP',   'CHK',    'VRV Wall Checking 2-2.5 HP',         140000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('VW-KA-2-2.5',      '2-2.5 HP',   'KA',     'VRV Wall Kategori A 2-2.5 HP',       275000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VW-KB-2-2.5',      '2-2.5 HP',   'KB',     'VRV Wall Kategori B 2-2.5 HP',       365000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VW-KC-2-2.5',      '2-2.5 HP',   'KC',     'VRV Wall Kategori C 2-2.5 HP',       475000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VW-KD-2-2.5',      '2-2.5 HP',   'KD',     'VRV Wall Kategori D 2-2.5 HP',       595000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VW-CLMIN-2-2.5',   '2-2.5 HP',   'CL_MIN', 'VRV Wall Cleaning Minor 2-2.5 HP',   190000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VW-CLMAJ-2-2.5',   '2-2.5 HP',   'CL_MAJ', 'VRV Wall Cleaning Major 2-2.5 HP',   325000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  -- band: 3-4 HP (~55% up)
  ('VW-CHK-3-4',       '3-4 HP',     'CHK',    'VRV Wall Checking 3-4 HP',           170000, ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja pendinginan']::text[], TRUE),
  ('VW-KA-3-4',        '3-4 HP',     'KA',     'VRV Wall Kategori A 3-4 HP',         340000, ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VW-KB-3-4',        '3-4 HP',     'KB',     'VRV Wall Kategori B 3-4 HP',         450000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VW-KC-3-4',        '3-4 HP',     'KC',     'VRV Wall Kategori C 3-4 HP',         585000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VW-KD-3-4',        '3-4 HP',     'KD',     'VRV Wall Kategori D 3-4 HP',         735000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VW-CLMIN-3-4',     '3-4 HP',     'CL_MIN', 'VRV Wall Cleaning Minor 3-4 HP',     235000, ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VW-CLMAJ-3-4',     '3-4 HP',     'CL_MAJ', 'VRV Wall Cleaning Major 3-4 HP',     400000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. VRV CASSETTE DUCTING  (prefix VCD)  — large commercial VRF indoor.
--    13 service types: standard (CHK/KA/KB/KC/KD/CL_MIN/CL_MAJ) + diagnostic
--    (PCEK) + component-replacement labour fees (PG_EL/PG_EV/PG_KO/PG_KD/PG_FM).
--    Band factors vs 8-12 HP base: 14-20 ~ +30%, 18-40 ~ +60%, 42-60 ~ +100%.
--    PG_* are labour/service fees; physical parts are billed separately.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'VRV Cassette Ducting'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 8-12 HP (base)
  ('VCD-CHK-8-12',   '8-12 HP', 'CHK',    'VRV Cassette Ducting Checking 8-12 HP',            250000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja sistem VRF']::text[], TRUE),
  ('VCD-KA-8-12',    '8-12 HP', 'KA',     'VRV Cassette Ducting Kategori A 8-12 HP',          400000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VCD-KB-8-12',    '8-12 HP', 'KB',     'VRV Cassette Ducting Kategori B 8-12 HP',          525000,  ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VCD-KC-8-12',    '8-12 HP', 'KC',     'VRV Cassette Ducting Kategori C 8-12 HP',          685000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VCD-KD-8-12',    '8-12 HP', 'KD',     'VRV Cassette Ducting Kategori D 8-12 HP',          850000,  ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VCD-CLMIN-8-12', '8-12 HP', 'CL_MIN', 'VRV Cassette Ducting Cleaning Minor 8-12 HP',      350000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VCD-CLMAJ-8-12', '8-12 HP', 'CL_MAJ', 'VRV Cassette Ducting Cleaning Major 8-12 HP',      575000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  ('VCD-PCEK-8-12',  '8-12 HP', 'PCEK',   'VRV Cassette Ducting Pengecekan 8-12 HP',          300000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VCD-PG_EL-8-12', '8-12 HP', 'PG_EL',  'VRV Cassette Ducting Ganti Elektrikal 8-12 HP',    350000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_EV-8-12', '8-12 HP', 'PG_EV',  'VRV Cassette Ducting Ganti Evaporator 8-12 HP',    450000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_KO-8-12', '8-12 HP', 'PG_KO',  'VRV Cassette Ducting Ganti Kompresor 8-12 HP',     1200000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VCD-PG_KD-8-12', '8-12 HP', 'PG_KD',  'VRV Cassette Ducting Ganti Kondensor 8-12 HP',     550000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_FM-8-12', '8-12 HP', 'PG_FM',  'VRV Cassette Ducting Ganti Fan Motor 8-12 HP',     400000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 14-20 HP (~+30%)
  ('VCD-CHK-14-20',   '14-20 HP', 'CHK',    'VRV Cassette Ducting Checking 14-20 HP',          325000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja sistem VRF']::text[], TRUE),
  ('VCD-KA-14-20',    '14-20 HP', 'KA',     'VRV Cassette Ducting Kategori A 14-20 HP',        520000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VCD-KB-14-20',    '14-20 HP', 'KB',     'VRV Cassette Ducting Kategori B 14-20 HP',        685000,  ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VCD-KC-14-20',    '14-20 HP', 'KC',     'VRV Cassette Ducting Kategori C 14-20 HP',        890000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VCD-KD-14-20',    '14-20 HP', 'KD',     'VRV Cassette Ducting Kategori D 14-20 HP',        1105000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VCD-CLMIN-14-20', '14-20 HP', 'CL_MIN', 'VRV Cassette Ducting Cleaning Minor 14-20 HP',    455000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VCD-CLMAJ-14-20', '14-20 HP', 'CL_MAJ', 'VRV Cassette Ducting Cleaning Major 14-20 HP',    750000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  ('VCD-PCEK-14-20',  '14-20 HP', 'PCEK',   'VRV Cassette Ducting Pengecekan 14-20 HP',        390000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VCD-PG_EL-14-20', '14-20 HP', 'PG_EL',  'VRV Cassette Ducting Ganti Elektrikal 14-20 HP',  455000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_EV-14-20', '14-20 HP', 'PG_EV',  'VRV Cassette Ducting Ganti Evaporator 14-20 HP',  585000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_KO-14-20', '14-20 HP', 'PG_KO',  'VRV Cassette Ducting Ganti Kompresor 14-20 HP',   1560000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VCD-PG_KD-14-20', '14-20 HP', 'PG_KD',  'VRV Cassette Ducting Ganti Kondensor 14-20 HP',   715000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_FM-14-20', '14-20 HP', 'PG_FM',  'VRV Cassette Ducting Ganti Fan Motor 14-20 HP',   520000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 18-40 HP (~+60%)
  ('VCD-CHK-18-40',   '18-40 HP', 'CHK',    'VRV Cassette Ducting Checking 18-40 HP',          400000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja sistem VRF']::text[], TRUE),
  ('VCD-KA-18-40',    '18-40 HP', 'KA',     'VRV Cassette Ducting Kategori A 18-40 HP',        640000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VCD-KB-18-40',    '18-40 HP', 'KB',     'VRV Cassette Ducting Kategori B 18-40 HP',        840000,  ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VCD-KC-18-40',    '18-40 HP', 'KC',     'VRV Cassette Ducting Kategori C 18-40 HP',        1095000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VCD-KD-18-40',    '18-40 HP', 'KD',     'VRV Cassette Ducting Kategori D 18-40 HP',        1360000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VCD-CLMIN-18-40', '18-40 HP', 'CL_MIN', 'VRV Cassette Ducting Cleaning Minor 18-40 HP',    560000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VCD-CLMAJ-18-40', '18-40 HP', 'CL_MAJ', 'VRV Cassette Ducting Cleaning Major 18-40 HP',    920000,  ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  ('VCD-PCEK-18-40',  '18-40 HP', 'PCEK',   'VRV Cassette Ducting Pengecekan 18-40 HP',        480000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VCD-PG_EL-18-40', '18-40 HP', 'PG_EL',  'VRV Cassette Ducting Ganti Elektrikal 18-40 HP',  560000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_EV-18-40', '18-40 HP', 'PG_EV',  'VRV Cassette Ducting Ganti Evaporator 18-40 HP',  720000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_KO-18-40', '18-40 HP', 'PG_KO',  'VRV Cassette Ducting Ganti Kompresor 18-40 HP',   1920000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VCD-PG_KD-18-40', '18-40 HP', 'PG_KD',  'VRV Cassette Ducting Ganti Kondensor 18-40 HP',   880000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_FM-18-40', '18-40 HP', 'PG_FM',  'VRV Cassette Ducting Ganti Fan Motor 18-40 HP',   640000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 42-60 HP (~+100%)
  ('VCD-CHK-42-60',   '42-60 HP', 'CHK',    'VRV Cassette Ducting Checking 42-60 HP',          500000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja sistem VRF']::text[], TRUE),
  ('VCD-KA-42-60',    '42-60 HP', 'KA',     'VRV Cassette Ducting Kategori A 42-60 HP',        800000,  ARRAY['Servis ringan','Pembersihan filter']::text[], TRUE),
  ('VCD-KB-42-60',    '42-60 HP', 'KB',     'VRV Cassette Ducting Kategori B 42-60 HP',        1050000, ARRAY['Servis sedang','Pembersihan evaporator']::text[], TRUE),
  ('VCD-KC-42-60',    '42-60 HP', 'KC',     'VRV Cassette Ducting Kategori C 42-60 HP',        1370000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VCD-KD-42-60',    '42-60 HP', 'KD',     'VRV Cassette Ducting Kategori D 42-60 HP',        1700000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VCD-CLMIN-42-60', '42-60 HP', 'CL_MIN', 'VRV Cassette Ducting Cleaning Minor 42-60 HP',    700000,  ARRAY['Pembersihan filter','Pembersihan blower']::text[], TRUE),
  ('VCD-CLMAJ-42-60', '42-60 HP', 'CL_MAJ', 'VRV Cassette Ducting Cleaning Major 42-60 HP',    1150000, ARRAY['Pembersihan menyeluruh','Bongkar pasang indoor']::text[], TRUE),
  ('VCD-PCEK-42-60',  '42-60 HP', 'PCEK',   'VRV Cassette Ducting Pengecekan 42-60 HP',        600000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VCD-PG_EL-42-60', '42-60 HP', 'PG_EL',  'VRV Cassette Ducting Ganti Elektrikal 42-60 HP',  700000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_EV-42-60', '42-60 HP', 'PG_EV',  'VRV Cassette Ducting Ganti Evaporator 42-60 HP',  900000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_KO-42-60', '42-60 HP', 'PG_KO',  'VRV Cassette Ducting Ganti Kompresor 42-60 HP',   2400000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VCD-PG_KD-42-60', '42-60 HP', 'PG_KD',  'VRV Cassette Ducting Ganti Kondensor 42-60 HP',   1100000, ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VCD-PG_FM-42-60', '42-60 HP', 'PG_FM',  'VRV Cassette Ducting Ganti Fan Motor 42-60 HP',   800000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. VRV OUTDOOR  (prefix VO)  — large commercial VRF condensing units.
--    Same 13-service taxonomy and band factors as VRV Cassette Ducting; outdoor
--    work centres on the condenser/compressor so includes differ accordingly.
--    Band factors vs 8-12 HP base: 14-20 ~ +30%, 18-40 ~ +60%, 42-60 ~ +100%.
-- -----------------------------------------------------------------------------
WITH ut AS (
  SELECT unit_type_id FROM public.unit_types WHERE name = 'VRV Outdoor'
)
INSERT INTO public.service_catalog (
  msn_code, unit_type_id, capacity_id, service_type_id,
  service_name, base_price, includes, is_active
)
SELECT
  v.msn_code, ut.unit_type_id, cr.capacity_id, st.service_type_id,
  v.service_name, v.base_price, v.includes, v.is_active
FROM ut
CROSS JOIN (VALUES
  -- band: 8-12 HP (base)
  ('VO-CHK-8-12',   '8-12 HP', 'CHK',    'VRV Outdoor Checking 8-12 HP',          250000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('VO-KA-8-12',    '8-12 HP', 'KA',     'VRV Outdoor Kategori A 8-12 HP',        400000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('VO-KB-8-12',    '8-12 HP', 'KB',     'VRV Outdoor Kategori B 8-12 HP',        525000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('VO-KC-8-12',    '8-12 HP', 'KC',     'VRV Outdoor Kategori C 8-12 HP',        685000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VO-KD-8-12',    '8-12 HP', 'KD',     'VRV Outdoor Kategori D 8-12 HP',        850000,  ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VO-CLMIN-8-12', '8-12 HP', 'CL_MIN', 'VRV Outdoor Cleaning Minor 8-12 HP',    350000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('VO-CLMAJ-8-12', '8-12 HP', 'CL_MAJ', 'VRV Outdoor Cleaning Major 8-12 HP',    575000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  ('VO-PCEK-8-12',  '8-12 HP', 'PCEK',   'VRV Outdoor Pengecekan 8-12 HP',        300000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VO-PG_EL-8-12', '8-12 HP', 'PG_EL',  'VRV Outdoor Ganti Elektrikal 8-12 HP',  350000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_EV-8-12', '8-12 HP', 'PG_EV',  'VRV Outdoor Ganti Evaporator 8-12 HP',  450000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_KO-8-12', '8-12 HP', 'PG_KO',  'VRV Outdoor Ganti Kompresor 8-12 HP',   1200000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VO-PG_KD-8-12', '8-12 HP', 'PG_KD',  'VRV Outdoor Ganti Kondensor 8-12 HP',   550000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_FM-8-12', '8-12 HP', 'PG_FM',  'VRV Outdoor Ganti Fan Motor 8-12 HP',   400000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 14-20 HP (~+30%)
  ('VO-CHK-14-20',   '14-20 HP', 'CHK',    'VRV Outdoor Checking 14-20 HP',          325000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('VO-KA-14-20',    '14-20 HP', 'KA',     'VRV Outdoor Kategori A 14-20 HP',        520000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('VO-KB-14-20',    '14-20 HP', 'KB',     'VRV Outdoor Kategori B 14-20 HP',        685000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('VO-KC-14-20',    '14-20 HP', 'KC',     'VRV Outdoor Kategori C 14-20 HP',        890000,  ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VO-KD-14-20',    '14-20 HP', 'KD',     'VRV Outdoor Kategori D 14-20 HP',        1105000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VO-CLMIN-14-20', '14-20 HP', 'CL_MIN', 'VRV Outdoor Cleaning Minor 14-20 HP',    455000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('VO-CLMAJ-14-20', '14-20 HP', 'CL_MAJ', 'VRV Outdoor Cleaning Major 14-20 HP',    750000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  ('VO-PCEK-14-20',  '14-20 HP', 'PCEK',   'VRV Outdoor Pengecekan 14-20 HP',        390000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VO-PG_EL-14-20', '14-20 HP', 'PG_EL',  'VRV Outdoor Ganti Elektrikal 14-20 HP',  455000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_EV-14-20', '14-20 HP', 'PG_EV',  'VRV Outdoor Ganti Evaporator 14-20 HP',  585000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_KO-14-20', '14-20 HP', 'PG_KO',  'VRV Outdoor Ganti Kompresor 14-20 HP',   1560000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VO-PG_KD-14-20', '14-20 HP', 'PG_KD',  'VRV Outdoor Ganti Kondensor 14-20 HP',   715000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_FM-14-20', '14-20 HP', 'PG_FM',  'VRV Outdoor Ganti Fan Motor 14-20 HP',   520000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 18-40 HP (~+60%)
  ('VO-CHK-18-40',   '18-40 HP', 'CHK',    'VRV Outdoor Checking 18-40 HP',          400000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('VO-KA-18-40',    '18-40 HP', 'KA',     'VRV Outdoor Kategori A 18-40 HP',        640000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('VO-KB-18-40',    '18-40 HP', 'KB',     'VRV Outdoor Kategori B 18-40 HP',        840000,  ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('VO-KC-18-40',    '18-40 HP', 'KC',     'VRV Outdoor Kategori C 18-40 HP',        1095000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VO-KD-18-40',    '18-40 HP', 'KD',     'VRV Outdoor Kategori D 18-40 HP',        1360000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VO-CLMIN-18-40', '18-40 HP', 'CL_MIN', 'VRV Outdoor Cleaning Minor 18-40 HP',    560000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('VO-CLMAJ-18-40', '18-40 HP', 'CL_MAJ', 'VRV Outdoor Cleaning Major 18-40 HP',    920000,  ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  ('VO-PCEK-18-40',  '18-40 HP', 'PCEK',   'VRV Outdoor Pengecekan 18-40 HP',        480000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VO-PG_EL-18-40', '18-40 HP', 'PG_EL',  'VRV Outdoor Ganti Elektrikal 18-40 HP',  560000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_EV-18-40', '18-40 HP', 'PG_EV',  'VRV Outdoor Ganti Evaporator 18-40 HP',  720000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_KO-18-40', '18-40 HP', 'PG_KO',  'VRV Outdoor Ganti Kompresor 18-40 HP',   1920000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VO-PG_KD-18-40', '18-40 HP', 'PG_KD',  'VRV Outdoor Ganti Kondensor 18-40 HP',   880000,  ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_FM-18-40', '18-40 HP', 'PG_FM',  'VRV Outdoor Ganti Fan Motor 18-40 HP',   640000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE),
  -- band: 42-60 HP (~+100%)
  ('VO-CHK-42-60',   '42-60 HP', 'CHK',    'VRV Outdoor Checking 42-60 HP',          500000,  ARRAY['Pemeriksaan tekanan freon','Cek kelistrikan','Cek kinerja kompresor']::text[], TRUE),
  ('VO-KA-42-60',    '42-60 HP', 'KA',     'VRV Outdoor Kategori A 42-60 HP',        800000,  ARRAY['Servis ringan','Pembersihan kondensor']::text[], TRUE),
  ('VO-KB-42-60',    '42-60 HP', 'KB',     'VRV Outdoor Kategori B 42-60 HP',        1050000, ARRAY['Servis sedang','Pembersihan kondensor menyeluruh']::text[], TRUE),
  ('VO-KC-42-60',    '42-60 HP', 'KC',     'VRV Outdoor Kategori C 42-60 HP',        1370000, ARRAY['Servis berat','Pembersihan menyeluruh']::text[], TRUE),
  ('VO-KD-42-60',    '42-60 HP', 'KD',     'VRV Outdoor Kategori D 42-60 HP',        1700000, ARRAY['Servis lengkap','Overhaul ringan']::text[], TRUE),
  ('VO-CLMIN-42-60', '42-60 HP', 'CL_MIN', 'VRV Outdoor Cleaning Minor 42-60 HP',    700000,  ARRAY['Pembersihan kondensor','Pembersihan kipas']::text[], TRUE),
  ('VO-CLMAJ-42-60', '42-60 HP', 'CL_MAJ', 'VRV Outdoor Cleaning Major 42-60 HP',    1150000, ARRAY['Pembersihan menyeluruh','Vakum sistem']::text[], TRUE),
  ('VO-PCEK-42-60',  '42-60 HP', 'PCEK',   'VRV Outdoor Pengecekan 42-60 HP',        600000,  ARRAY['Diagnostik sistem','Cek error code','Pengukuran parameter']::text[], TRUE),
  ('VO-PG_EL-42-60', '42-60 HP', 'PG_EL',  'VRV Outdoor Ganti Elektrikal 42-60 HP',  700000,  ARRAY['Penggantian komponen elektrikal','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_EV-42-60', '42-60 HP', 'PG_EV',  'VRV Outdoor Ganti Evaporator 42-60 HP',  900000,  ARRAY['Penggantian evaporator','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_KO-42-60', '42-60 HP', 'PG_KO',  'VRV Outdoor Ganti Kompresor 42-60 HP',   2400000, ARRAY['Penggantian kompresor','Jasa pemasangan','Vakum & isi freon']::text[], TRUE),
  ('VO-PG_KD-42-60', '42-60 HP', 'PG_KD',  'VRV Outdoor Ganti Kondensor 42-60 HP',   1100000, ARRAY['Penggantian kondensor','Jasa pemasangan']::text[], TRUE),
  ('VO-PG_FM-42-60', '42-60 HP', 'PG_FM',  'VRV Outdoor Ganti Fan Motor 42-60 HP',   800000,  ARRAY['Penggantian fan motor','Jasa pemasangan']::text[], TRUE)
) AS v(msn_code, capacity_label, service_code, service_name, base_price, includes, is_active)
JOIN public.service_types st
  ON st.code = v.service_code
JOIN public.capacity_ranges cr
  ON cr.unit_type_id = ut.unit_type_id
 AND cr.capacity_label = v.capacity_label
ON CONFLICT (msn_code) DO NOTHING;

-- =============================================================================
-- End of 03_seed_catalog_mnx_vrv.sql
-- =============================================================================
