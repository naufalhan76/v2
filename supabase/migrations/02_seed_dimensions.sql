-- =============================================================================
-- 02_seed_dimensions.sql — Idempotent seed for AC service catalog dimensions
-- -----------------------------------------------------------------------------
-- Seeds the three foundational dimension tables for the service catalog:
--   1. unit_types       (13 canonical AC unit types)
--   2. service_types    (catalog service codes + legacy ENUM-derived types)
--   3. capacity_ranges  (per-unit-type capacity bands; HP for AC, Kg for refrigerant)
--
-- Idempotency:
--   * unit_types       -> ON CONFLICT (name) DO NOTHING       (name is UNIQUE)
--   * service_types    -> ON CONFLICT (code) DO NOTHING       (code is UNIQUE)
--   * capacity_ranges  -> ON CONFLICT (unit_type_id, capacity_label) DO NOTHING
--                         (enforced by a partial-free UNIQUE index created below)
--
-- No hardcoded UUIDs: PKs use the schema DEFAULT gen_random_uuid(); foreign keys
-- are resolved via name-based subqueries against unit_types.
--
-- Re-running this migration produces no errors and inserts no duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Enable ON CONFLICT for capacity_ranges
--    The base schema (00_v2_schema.sql) defines no UNIQUE constraint on
--    capacity_ranges beyond the PK. Add a UNIQUE index on (unit_type_id,
--    capacity_label) so the seed inserts below can use ON CONFLICT safely.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_capacity_ranges_unit_label
  ON public.capacity_ranges (unit_type_id, capacity_label);

-- -----------------------------------------------------------------------------
-- 1. UNIT TYPES (13 canonical AC unit types)
--    ON CONFLICT (name) DO NOTHING — name is UNIQUE per schema.
-- -----------------------------------------------------------------------------
INSERT INTO public.unit_types (name, description, display_order, is_active) VALUES
  ('Room Air',             'Wall-mounted split room air conditioner',        1,  TRUE),
  ('Air Purifier',         'Standalone air purification unit',               2,  TRUE),
  ('SkyAir Cassette',      'Daikin SkyAir cassette ceiling unit',            3,  TRUE),
  ('Split Duct',           'Concealed split ducted air conditioner',         4,  TRUE),
  ('Standing Floor',       'Floor-standing package air conditioner',         5,  TRUE),
  ('AHU',                  'Air Handling Unit',                              6,  TRUE),
  ('Refrigerant',          'Refrigerant top-up / refill (weight-based)',     7,  TRUE),
  ('MNX Wall',             'Mini VRV / MNX wall-mounted indoor unit',        8,  TRUE),
  ('MNX Cassette/Duct',    'Mini VRV / MNX cassette or ducted indoor unit',  9,  TRUE),
  ('MNX Outdoor',          'Mini VRV / MNX outdoor condensing unit',         10, TRUE),
  ('VRV Wall',             'VRV/VRF wall-mounted indoor unit',               11, TRUE),
  ('VRV Cassette Ducting', 'VRV/VRF cassette or ducted indoor unit',         12, TRUE),
  ('VRV Outdoor',          'VRV/VRF outdoor condensing unit',                13, TRUE)
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. SERVICE TYPES
--    ON CONFLICT (code) DO NOTHING — code is UNIQUE per schema.
--    Includes the catalog service codes plus the legacy ENUM-derived types so
--    that lookups by either taxonomy resolve to a row.
-- -----------------------------------------------------------------------------
INSERT INTO public.service_types (code, name, description, display_order, is_active) VALUES
  -- Catalog service codes
  ('CHK',     'CHECKING',                          'General inspection / checking visit',            1,  TRUE),
  ('KA',      'KATEGORI A',                        'Service category A',                             2,  TRUE),
  ('KB',      'KATEGORI B',                        'Service category B',                             3,  TRUE),
  ('KC',      'KATEGORI C',                        'Service category C',                             4,  TRUE),
  ('KD',      'KATEGORI D',                        'Service category D',                             5,  TRUE),
  ('CL_MIN',  'CLEANING MINOR',                    'Minor cleaning service',                         6,  TRUE),
  ('CL_MAJ',  'CLEANING MAJOR',                    'Major / deep cleaning service',                  7,  TRUE),
  ('PCEK',    'PENGECEKAN',                        'Diagnostic check-up',                            8,  TRUE),
  ('PG_EL',   'PENGGANTIAN KOMPONEN ELEKTRIKAL',   'Replacement of electrical components',           9,  TRUE),
  ('PG_EV',   'PENGGANTIAN EVAPORATOR',            'Evaporator replacement',                         10, TRUE),
  ('PG_KO',   'PENGGANTIAN KOMPRESOR',             'Compressor replacement',                         11, TRUE),
  ('PG_KD',   'PENGGANTIAN KONDENSOR',             'Condenser replacement',                          12, TRUE),
  ('PG_FM',   'PENGGANTIAN FAN MOTOR',             'Fan motor replacement',                          13, TRUE),
  -- Legacy ENUM-derived service types (kept for compatibility with service_pricing)
  ('CLEANING',      'CLEANING',      'Legacy cleaning service type',        100, TRUE),
  ('REFILL_FREON',  'REFILL FREON',  'Legacy refrigerant refill type',      101, TRUE),
  ('REPAIR',        'REPAIR',        'Legacy repair service type',          102, TRUE),
  ('INSTALLATION',  'INSTALLATION',  'Legacy installation service type',    103, TRUE),
  ('INSPECTION',    'INSPECTION',    'Legacy inspection service type',      104, TRUE),
  ('MULTI_SERVICE', 'MULTI SERVICE', 'Legacy combined multi-service type',  105, TRUE),
  ('UNINSTALL',     'UNINSTALL',     'Legacy uninstall service type',       106, TRUE),
  ('MAINTENANCE',   'MAINTENANCE',   'Legacy maintenance service type',     107, TRUE)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. CAPACITY RANGES (per unit_type)
--    unit_type_id resolved via name-based subquery (no hardcoded UUIDs).
--    ON CONFLICT (unit_type_id, capacity_label) DO NOTHING via the unique index
--    created at the top of this migration.
--    Capacity bands use HP for AC units; Refrigerant uses Kg (weight-based).
-- -----------------------------------------------------------------------------

-- Room Air
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('0.5-1.5 HP', 1),
  ('2-2.5 HP',   2),
  ('3 HP',       3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'Room Air'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- Air Purifier (single capacity band — capacity not HP-rated)
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('All Capacities', 1)
) AS v(capacity_label, display_order)
WHERE ut.name = 'Air Purifier'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- SkyAir Cassette
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('0.5-2 HP', 1),
  ('2.5-5 HP', 2),
  ('6-8 HP',   3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'SkyAir Cassette'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- Split Duct
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('2-3 HP', 1),
  ('4-5 HP', 2),
  ('6-8 HP', 3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'Split Duct'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- Standing Floor
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('3-5 HP',  1),
  ('6-10 HP', 2)
) AS v(capacity_label, display_order)
WHERE ut.name = 'Standing Floor'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- AHU (Air Handling Unit)
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('5-10 HP',  1),
  ('11-20 HP', 2),
  ('21-40 HP', 3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'AHU'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- Refrigerant (weight-based, Kg)
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('0.5 Kg', 1),
  ('1 Kg',   2),
  ('2 Kg',   3),
  ('5 Kg',   4)
) AS v(capacity_label, display_order)
WHERE ut.name = 'Refrigerant'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- MNX Wall
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('0.5-1.5 HP', 1),
  ('2-2.5 HP',   2),
  ('3 HP',       3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'MNX Wall'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- MNX Cassette/Duct
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('2-3 HP', 1),
  ('4-5 HP', 2),
  ('6-8 HP', 3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'MNX Cassette/Duct'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- MNX Outdoor
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('4-6 HP',  1),
  ('8-10 HP', 2),
  ('12-16 HP', 3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'MNX Outdoor'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- VRV Wall
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('0.8-1.5 HP', 1),
  ('2-2.5 HP',   2),
  ('3-4 HP',     3)
) AS v(capacity_label, display_order)
WHERE ut.name = 'VRV Wall'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- VRV Cassette Ducting
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('8-12 HP',  1),
  ('14-20 HP', 2),
  ('18-40 HP', 3),
  ('42-60 HP', 4)
) AS v(capacity_label, display_order)
WHERE ut.name = 'VRV Cassette Ducting'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- VRV Outdoor
INSERT INTO public.capacity_ranges (unit_type_id, capacity_label, display_order, is_active)
SELECT ut.unit_type_id, v.capacity_label, v.display_order, TRUE
FROM public.unit_types ut
CROSS JOIN (VALUES
  ('8-12 HP',  1),
  ('14-20 HP', 2),
  ('18-40 HP', 3),
  ('42-60 HP', 4)
) AS v(capacity_label, display_order)
WHERE ut.name = 'VRV Outdoor'
ON CONFLICT (unit_type_id, capacity_label) DO NOTHING;

-- =============================================================================
-- End of 02_seed_dimensions.sql
-- =============================================================================
