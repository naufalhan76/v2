-- Backfill: flatten per-AC photos from ac_units JSONB into top-level
-- photos_before/photos_after arrays on service_reports, AND convert any
-- stored signed/public URLs back to storage paths.
--
-- Root cause: sync-reports.ts only routed acUnitIdx === -1 photos to the
-- top-level arrays, but the technician app only takes per-AC photos
-- (acUnitIdx >= 0). Result: top-level columns were always empty [].
--
-- Idempotent: re-running re-derives the same arrays (= not ||).

UPDATE service_reports
SET
  photos_before = ARRAY(
    SELECT DISTINCT
      CASE
        WHEN path ~ '^https?://' THEN substring(path FROM '/service-photos/(.+?)(\?|$)')
        ELSE path
      END
    FROM jsonb_array_elements(ac_units) AS unit
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(unit->'photos_before', '[]'::jsonb)
    ) AS path
  ),
  photos_after = ARRAY(
    SELECT DISTINCT
      CASE
        WHEN path ~ '^https?://' THEN substring(path FROM '/service-photos/(.+?)(\?|$)')
        ELSE path
      END
    FROM jsonb_array_elements(ac_units) AS unit
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(unit->'photos_after', '[]'::jsonb)
    ) AS path
  ),
  customer_signature_url = CASE
    WHEN customer_signature_url ~ '^https?://.*signatures/' THEN
      substring(customer_signature_url FROM '/signatures/(.+?)(\?|$)')
    ELSE customer_signature_url
  END
WHERE ac_units IS NOT NULL
  AND jsonb_array_length(ac_units) > 0
  AND deleted_at IS NULL;
