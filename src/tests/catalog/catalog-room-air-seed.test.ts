import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/03_seed_catalog_room_air.sql'
);

const ROOM_AIR_CAPACITIES = ['0.5-1.5 HP', '2-2.5 HP', '3 HP'];
const ROOM_AIR_SERVICE_CODES = ['CHK', 'KA', 'KB', 'KC', 'KD', 'CL_MIN', 'CL_MAJ'];

const ROOM_AIR_MSN_CODES = [
  'RA-CHK-0.5-1.5', 'RA-KA-0.5-1.5', 'RA-KB-0.5-1.5', 'RA-KC-0.5-1.5',
  'RA-KD-0.5-1.5', 'RA-CLMIN-0.5-1.5', 'RA-CLMAJ-0.5-1.5',
  'RA-CHK-2-2.5', 'RA-KA-2-2.5', 'RA-KB-2-2.5', 'RA-KC-2-2.5',
  'RA-KD-2-2.5', 'RA-CLMIN-2-2.5', 'RA-CLMAJ-2-2.5',
  'RA-CHK-3', 'RA-KA-3', 'RA-KB-3', 'RA-KC-3',
  'RA-KD-3', 'RA-CLMIN-3', 'RA-CLMAJ-3',
];

const AIR_PURIFIER_PRICED_MSN_CODES = ['AP-CHK', 'AP-CLMIN', 'AP-CLMAJ'];
const AIR_PURIFIER_ZERO_MSN_CODES = ['AP-KA', 'AP-KB', 'AP-KC', 'AP-KD'];

describe('03_seed_catalog_room_air.sql migration', () => {
  let sql = '';

  beforeAll(() => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  describe('table references', () => {
    it('inserts into service_catalog', () => {
      expect(sql).toContain('INSERT INTO public.service_catalog');
    });

    it('does not touch dimension tables', () => {
      expect(sql).not.toContain('INSERT INTO public.unit_types');
      expect(sql).not.toContain('INSERT INTO public.service_types');
      expect(sql).not.toContain('INSERT INTO public.capacity_ranges');
    });
  });

  describe('column names match 00_v2_schema.sql', () => {
    it('uses the service_catalog insert column list', () => {
      expect(sql).toMatch(
        /INSERT INTO public\.service_catalog \(\s*msn_code, unit_type_id, capacity_id, service_type_id,\s*service_name, base_price, includes, is_active\s*\)/
      );
    });

    it('does not reference a DID Code column', () => {
      expect(sql).not.toMatch(/did_code/i);
    });
  });

  describe('CTE / FK resolution (no hardcoded UUIDs)', () => {
    it('resolves Room Air unit_type via a CTE name lookup', () => {
      expect(sql).toMatch(
        /WITH ut AS \(\s*SELECT unit_type_id FROM public\.unit_types WHERE name = 'Room Air'\s*\)/
      );
    });

    it('resolves Air Purifier unit_type via a CTE name lookup', () => {
      expect(sql).toMatch(
        /WITH ut AS \(\s*SELECT unit_type_id FROM public\.unit_types WHERE name = 'Air Purifier'\s*\)/
      );
    });

    it('joins service_types by code', () => {
      expect(sql).toMatch(/JOIN public\.service_types st\s*ON st\.code = v\.service_code/);
    });

    it('joins capacity_ranges by unit_type_id + capacity_label', () => {
      expect(sql).toMatch(
        /JOIN public\.capacity_ranges cr\s*ON cr\.unit_type_id = ut\.unit_type_id\s*AND cr\.capacity_label = v\.capacity_label/
      );
    });

    it('contains no hardcoded UUID literals', () => {
      expect(sql).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
    });
  });

  describe('idempotency', () => {
    it('uses ON CONFLICT (msn_code) DO NOTHING', () => {
      expect(sql).toMatch(/ON CONFLICT \(msn_code\) DO NOTHING/);
    });

    it('every INSERT has an ON CONFLICT DO NOTHING clause', () => {
      const inserts = sql.match(/INSERT INTO public\.[a-z_]+/g) ?? [];
      const conflicts = sql.match(/ON CONFLICT[\s\S]*?DO NOTHING/g) ?? [];
      expect(inserts.length).toBeGreaterThan(0);
      expect(conflicts.length).toBeGreaterThanOrEqual(inserts.length);
    });
  });

  describe('Room Air seed data', () => {
    it.each(ROOM_AIR_CAPACITIES)('references capacity band "%s"', (band) => {
      expect(sql).toContain(`'${band}'`);
    });

    it.each(ROOM_AIR_SERVICE_CODES)('references service code "%s"', (code) => {
      expect(sql).toContain(`'${code}'`);
    });

    it.each(ROOM_AIR_MSN_CODES)('includes msn_code "%s"', (code) => {
      expect(sql).toContain(`'${code}'`);
    });

    it('seeds all 21 capacity x service combinations', () => {
      expect(ROOM_AIR_MSN_CODES).toHaveLength(
        ROOM_AIR_CAPACITIES.length * ROOM_AIR_SERVICE_CODES.length
      );
    });

    it('scales 3 HP prices above the 0.5-1.5 HP base', () => {
      expect(sql).toMatch(/'RA-CHK-0\.5-1\.5'[\s\S]*?75000/);
      expect(sql).toMatch(/'RA-CHK-3'[\s\S]*?115000/);
    });
  });

  describe('Air Purifier seed data', () => {
    it.each(AIR_PURIFIER_PRICED_MSN_CODES)('includes priced msn_code "%s"', (code) => {
      expect(sql).toContain(`'${code}'`);
    });

    it.each(AIR_PURIFIER_ZERO_MSN_CODES)('includes zero-price msn_code "%s"', (code) => {
      expect(sql).toContain(`'${code}'`);
    });

    it('uses the single "All Capacities" band for Air Purifier', () => {
      expect(sql).toContain(`'All Capacities'`);
    });
  });

  describe('zero-price / inactive rows', () => {
    it('seeds zero-price rows with FALSE is_active', () => {
      for (const code of AIR_PURIFIER_ZERO_MSN_CODES) {
        expect(sql).toMatch(new RegExp(`'${code}'[\\s\\S]*?0,\\s*NULL::text\\[\\],\\s*FALSE`));
      }
    });

    it('keeps priced rows active', () => {
      expect(sql).toMatch(/'AP-CHK'[\s\S]*?65000[\s\S]*?TRUE/);
    });
  });

  describe('safety constraints', () => {
    it('does not alter the service_type ENUM', () => {
      expect(sql).not.toMatch(/ALTER TYPE\s+service_type/i);
      expect(sql).not.toMatch(/ADD VALUE/i);
    });

    it('does not hard-delete or drop anything', () => {
      expect(sql).not.toMatch(/\bDELETE FROM\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    });
  });
});
