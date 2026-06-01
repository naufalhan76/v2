import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/02_seed_dimensions.sql'
);

const UNIT_TYPES = [
  'Room Air',
  'Air Purifier',
  'SkyAir Cassette',
  'Split Duct',
  'Standing Floor',
  'AHU',
  'Refrigerant',
  'MNX Wall',
  'MNX Cassette/Duct',
  'MNX Outdoor',
  'VRV Wall',
  'VRV Cassette Ducting',
  'VRV Outdoor',
];

const SERVICE_CODES = [
  'CHK',
  'KA',
  'KB',
  'KC',
  'KD',
  'CL_MIN',
  'CL_MAJ',
  'PCEK',
  'PG_EL',
  'PG_EV',
  'PG_KO',
  'PG_KD',
  'PG_FM',
  'CLEANING',
  'REFILL_FREON',
  'REPAIR',
  'INSTALLATION',
  'INSPECTION',
  'MULTI_SERVICE',
  'UNINSTALL',
  'MAINTENANCE',
];

const SERVICE_NAMES = [
  'CHECKING',
  'KATEGORI A',
  'KATEGORI B',
  'KATEGORI C',
  'KATEGORI D',
  'CLEANING MINOR',
  'CLEANING MAJOR',
  'PENGECEKAN',
  'PENGGANTIAN KOMPONEN ELEKTRIKAL',
  'PENGGANTIAN EVAPORATOR',
  'PENGGANTIAN KOMPRESOR',
  'PENGGANTIAN KONDENSOR',
  'PENGGANTIAN FAN MOTOR',
];

describe('02_seed_dimensions.sql migration', () => {
  let sql = '';

  beforeAll(() => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  describe('table references', () => {
    it('inserts into all three dimension tables', () => {
      expect(sql).toContain('INSERT INTO public.unit_types');
      expect(sql).toContain('INSERT INTO public.service_types');
      expect(sql).toContain('INSERT INTO public.capacity_ranges');
    });

    it('does not touch catalog or pricing tables', () => {
      expect(sql).not.toContain('INSERT INTO public.service_catalog');
      expect(sql).not.toContain('INSERT INTO public.service_pricing');
    });
  });

  describe('column names match 00_v2_schema.sql', () => {
    it('uses unit_types columns', () => {
      expect(sql).toMatch(
        /INSERT INTO public\.unit_types \(name, description, display_order, is_active\)/
      );
    });

    it('uses service_types columns', () => {
      expect(sql).toMatch(
        /INSERT INTO public\.service_types \(code, name, description, display_order, is_active\)/
      );
    });

    it('uses capacity_ranges columns', () => {
      expect(sql).toMatch(
        /INSERT INTO public\.capacity_ranges \(unit_type_id, capacity_label, display_order, is_active\)/
      );
    });

    it('does not reference non-existent min_capacity/max_capacity columns', () => {
      expect(sql).not.toMatch(/min_capacity/);
      expect(sql).not.toMatch(/max_capacity/);
    });
  });

  describe('idempotency clauses', () => {
    it('unit_types uses ON CONFLICT (name) DO NOTHING', () => {
      expect(sql).toMatch(/ON CONFLICT \(name\) DO NOTHING/);
    });

    it('service_types uses ON CONFLICT (code) DO NOTHING', () => {
      expect(sql).toMatch(/ON CONFLICT \(code\) DO NOTHING/);
    });

    it('capacity_ranges uses ON CONFLICT (unit_type_id, capacity_label) DO NOTHING', () => {
      expect(sql).toMatch(
        /ON CONFLICT \(unit_type_id, capacity_label\) DO NOTHING/
      );
    });

    it('creates the unique index that backs capacity_ranges ON CONFLICT', () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*?public\.capacity_ranges \(unit_type_id, capacity_label\)/
      );
    });

    it('every INSERT statement has an ON CONFLICT DO NOTHING clause', () => {
      const inserts = sql.match(/INSERT INTO public\.[a-z_]+/g) ?? [];
      const conflicts = sql.match(/ON CONFLICT[\s\S]*?DO NOTHING/g) ?? [];
      expect(inserts.length).toBeGreaterThan(0);
      expect(conflicts.length).toBeGreaterThanOrEqual(inserts.length);
    });
  });

  describe('unit_types seed data', () => {
    it.each(UNIT_TYPES)('includes unit type "%s"', (name) => {
      expect(sql).toContain(`'${name}'`);
    });

    it('seeds exactly 13 unit types', () => {
      expect(UNIT_TYPES).toHaveLength(13);
      for (const name of UNIT_TYPES) {
        expect(sql).toContain(`'${name}'`);
      }
    });
  });

  describe('service_types seed data', () => {
    it.each(SERVICE_CODES)('includes service code "%s"', (code) => {
      expect(sql).toContain(`'${code}'`);
    });

    it.each(SERVICE_NAMES)('includes service name "%s"', (name) => {
      expect(sql).toContain(`'${name}'`);
    });
  });

  describe('capacity_ranges seed data', () => {
    it('resolves unit_type_id via name-based subquery (no hardcoded UUIDs)', () => {
      expect(sql).toMatch(/FROM public\.unit_types ut/);
      expect(sql).toMatch(/WHERE ut\.name =/);
      expect(sql).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
    });

    it('seeds VRV capacity bands from the spec', () => {
      for (const band of ['8-12 HP', '14-20 HP', '18-40 HP', '42-60 HP']) {
        expect(sql).toContain(`'${band}'`);
      }
    });

    it('seeds Refrigerant capacity in Kg (weight-based)', () => {
      expect(sql).toMatch(/'\d+(\.\d+)? Kg'/);
    });

    it('seeds Room Air capacity bands from the spec', () => {
      for (const band of ['0.5-1.5 HP', '2-2.5 HP', '3 HP']) {
        expect(sql).toContain(`'${band}'`);
      }
    });
  });

  describe('safety constraints', () => {
    it('does not alter the service_type ENUM', () => {
      expect(sql).not.toMatch(/ALTER TYPE\s+service_type/i);
      expect(sql).not.toMatch(/ADD VALUE/i);
    });

    it('does not hard-delete any rows', () => {
      expect(sql).not.toMatch(/\bDELETE FROM\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    });
  });
});
