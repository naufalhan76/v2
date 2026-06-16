-- Make service-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'service-photos';

-- Drop public read policy
DROP POLICY IF EXISTS "Public read service-photos" ON storage.objects;

-- Authenticated users can read service-photos
CREATE POLICY "Authenticated read service-photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos');

-- Keep existing upload policies (authenticated users can upload)
-- No changes needed for INSERT/UPDATE policies
