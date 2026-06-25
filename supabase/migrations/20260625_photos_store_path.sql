-- Convert photos_before/photos_after from signed URLs back to storage paths.
-- Idempotent: re-running on already-converted rows is a no-op.
--
-- Storage path format: <orderId>/<filename> (e.g. "ORD-001/photo.jpg")
-- Old signed URL format: https://.../service-photos/<orderId>/<filename>?token=...
--
-- The regex extracts everything after "service-photos/" up to the first "?" or end of string.

UPDATE service_reports
SET photos_before = ARRAY(
  SELECT
    CASE
      WHEN elem ~ '^https?://' THEN substring(elem FROM '/service-photos/(.+?)(\?|$)')
      ELSE elem
    END
  FROM unnest(photos_before) AS t(elem)
)
WHERE photos_before IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(photos_before) AS t(elem)
    WHERE elem ~ '^https?://'
  );

UPDATE service_reports
SET photos_after = ARRAY(
  SELECT
    CASE
      WHEN elem ~ '^https?://' THEN substring(elem FROM '/service-photos/(.+?)(\?|$)')
      ELSE elem
    END
  FROM unnest(photos_after) AS t(elem)
)
WHERE photos_after IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(photos_after) AS t(elem)
    WHERE elem ~ '^https?://'
  );
