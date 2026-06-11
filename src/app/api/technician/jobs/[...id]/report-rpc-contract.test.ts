import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/09_technician_submit_report_rpc.sql'),
  'utf8'
)

describe('technician_submit_report_v2 AC contract SQL', () => {
  it('checks idempotency before inserting mutable report-side rows', () => {
    expect(sql).toMatch(/SELECT report_id INTO v_report_id[\s\S]*idempotency_key = v_idempotency_key[\s\S]*RETURN v_report_id;/)
    expect(sql.indexOf('SELECT report_id INTO v_report_id')).toBeLessThan(sql.indexOf('INSERT INTO public.service_reports'))
  })

  it('validates existing AC belongs to the submitted order customer and location', () => {
    expect(sql).toContain('JOIN public.locations l ON l.location_id = au.location_id')
    expect(sql).toContain('JOIN public.order_items oi ON oi.ac_unit_id = au.ac_unit_id')
    expect(sql).toContain('AND oi.order_id = p_order_id')
    expect(sql).toContain('AND l.customer_id = v_customer_id')
    expect(sql).toContain('AND au.location_id = oi.location_id')
  })

  it('blocks malicious identity overwrite for non-null existing AC identity columns', () => {
    expect(sql).toContain('Existing AC % brand_id cannot be overwritten')
    expect(sql).toContain('Existing AC % unit_type_id cannot be overwritten')
    expect(sql).toContain('Existing AC % capacity_id cannot be overwritten')
    expect(sql).toContain('brand_id = COALESCE(brand_id, NULLIF')
    expect(sql).toContain('unit_type_id = COALESCE(unit_type_id, NULLIF')
    expect(sql).toContain('capacity_id = COALESCE(capacity_id, NULLIF')
  })

  it('requires complete new AC identity and uses matched order_items.location_id', () => {
    expect(sql).toContain('New AC requires brand_id, unit_type_id, capacity_id, and room_location')
    expect(sql).toContain('SELECT oi.location_id INTO v_new_ac_location_id')
    expect(sql).toContain('FROM public.order_items oi')
    expect(sql).toContain('AND oi.ac_unit_id IS NULL')
    expect(sql).toContain('AND oi.order_item_id = v_order_item_id')
    expect(sql).toContain("AND oi.brand_id = NULLIF(v_ac_unit->>'brand_id', '')::uuid")
    expect(sql).toContain('SELECT COUNT(*), MIN(oi.location_id) INTO v_order_item_match_count, v_new_ac_location_id')
    expect(sql).toContain('New AC payload must match exactly one order item/location')
    expect(sql).toMatch(/VALUES \(\s+v_new_ac_location_id/)
    expect(sql).not.toContain('SELECT customer_id, location_id, status')
    expect(sql).not.toContain("v_ac_unit->>'location_id'")
    expect(sql).toContain("'ACTIVE'")
  })

  it('preserves the completion transition idempotency key and only transitions IN_PROGRESS once', () => {
    expect(sql).toContain('AND status = \'IN_PROGRESS\'')
    expect(sql).toMatch(/INSERT INTO public\.order_status_transitions[\s\S]*idempotency_key[\s\S]*v_idempotency_key/)
  })

  it('rejects stale catalog material selections before report insert', () => {
    expect(sql).toContain("p_payload->'materials'")
    expect(sql).toContain('FROM public.addon_catalog ac')
    expect(sql).toContain('WHERE ac.addon_id = v_addon_id')
    expect(sql).toContain('AND ac.is_active = true')
    expect(sql).toContain('Catalog addon % is inactive, deleted, or unavailable. Refresh material catalog and reselect.')
    expect(sql.indexOf('Catalog addon % is inactive')).toBeLessThan(sql.indexOf('INSERT INTO public.service_reports'))
  })

  it('accepts and stores work duration minutes on new report rows', () => {
    expect(sql).toContain('p_work_duration_minutes INT DEFAULT NULL')
    expect(sql).toContain('work_duration_minutes')
    expect(sql).toContain("COALESCE(p_work_duration_minutes, NULLIF(p_payload->>'work_duration_minutes', '')::int)")
  })

  it('RPC reads report fields from payload keys required by offline sync', () => {
    expect(sql).toContain("ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_before', '[]'::jsonb)))")
    expect(sql).toContain("ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_after', '[]'::jsonb)))")
    expect(sql).toContain("COALESCE(p_payload->'materials', '[]'::jsonb)")
    expect(sql).toContain("(p_payload->>'actual_total_price')::numeric")
    expect(sql).toContain("p_payload->>'customer_signature_url'")
    expect(sql).toContain("p_payload->>'customer_name_signed'")
    expect(sql).toContain("(p_payload->>'work_started_at')::timestamptz")
    expect(sql).toContain("(p_payload->>'work_completed_at')::timestamptz")
    expect(sql).toContain("COALESCE(p_payload->'ac_units', '[]'::jsonb)")
  })

  it('creates pending addon request rows for manual report materials after report idempotency guard', () => {
    expect(sql).toMatch(/SELECT report_id INTO v_report_id[\s\S]*idempotency_key = v_idempotency_key[\s\S]*RETURN v_report_id;/)
    expect(sql).toContain('INSERT INTO public.addon_requests')
    expect(sql).toContain("COALESCE((v_material->>'is_manual')::boolean, false)")
    expect(sql).toContain("NULLIF(v_material->>'addon_id', '') IS NULL")
    expect(sql).toContain("'PENDING'")
    expect(sql.indexOf('IF v_report_id IS NOT NULL')).toBeLessThan(sql.indexOf('INSERT INTO public.addon_requests'))
  })
})
