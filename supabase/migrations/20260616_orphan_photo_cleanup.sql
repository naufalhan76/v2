-- Cleanup orphan service photos from the storage bucket.
-- Deletes photos in the service-photos bucket that are:
--   1. Not referenced in service_reports.photos_before or photos_after arrays
--   2. Not referenced in service_reports.customer_signature_url
--   3. Older than 24 hours (grace period for in-flight uploads)

CREATE OR REPLACE FUNCTION public.cleanup_orphan_service_photos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_deleted_count INT := 0;
  v_orphan RECORD;
BEGIN
  FOR v_orphan IN
    SELECT so.id, so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'service-photos'
      AND so.created_at < NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM service_reports sr
        WHERE so.name = ANY(sr.photos_before)
           OR so.name = ANY(sr.photos_after)
           OR sr.customer_signature_url = so.name
      )
  LOOP
    DELETE FROM storage.objects WHERE id = v_orphan.id;
    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'executed_at', NOW()
  );
END;
$$;
