-- 06_storage_service_photos_bucket.sql
-- Creates the service-photos bucket and RLS policies for technician photo uploads.
-- Idempotent: safe to re-run.
--
-- Path layout: orders/<order_id>/<kind>/<timestamp>-<index>.jpg
--   e.g. orders/REQ-2026-05/000123/arrival/1700000000-0.jpg
--
-- Bucket is PUBLIC so supabase.storage.getPublicUrl() returns a fetchable URL.
-- Upload (INSERT) is restricted to authenticated technicians via RLS.

-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-photos',
  'service-photos',
  true,
  5242880, -- 5 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types= EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. RLS policies
-- ---------------------------------------------------------------------------

-- INSERT: authenticated technicians only
DROP POLICY IF EXISTS "Technicians can upload service photos" ON storage.objects;
CREATE POLICY "Technicians can upload service photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-photos'
    AND EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.auth_user_id = auth.uid()
    )
  );

-- SELECT: public (bucket is public, getPublicUrl() must work)
DROP POLICY IF EXISTS "Public read service-photos" ON storage.objects;
CREATE POLICY "Public read service-photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'service-photos');

-- UPDATE: authenticated technicians
DROP POLICY IF EXISTS "Technicians can update service photos" ON storage.objects;
CREATE POLICY "Technicians can update service photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-photos'
    AND EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'service-photos'
    AND EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.auth_user_id = auth.uid()
    )
  );

-- DELETE: authenticated technicians
DROP POLICY IF EXISTS "Technicians can delete service photos" ON storage.objects;
CREATE POLICY "Technicians can delete service photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-photos'
    AND EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.auth_user_id = auth.uid()
    )
  );
