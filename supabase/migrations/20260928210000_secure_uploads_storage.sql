-- Harden uploads storage: every browser upload must belong to an authenticated user.
-- Files are stored under <auth.uid()>/<filename> and the bucket is private.
-- Server-side functions use service_role and continue to work without these RLS restrictions.

UPDATE storage.buckets
SET public = false
WHERE id = 'uploads';

DROP POLICY IF EXISTS "public upload read" ON storage.objects;
DROP POLICY IF EXISTS "public upload insert" ON storage.objects;
DROP POLICY IF EXISTS "public upload delete" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_insert" ON storage.objects;

DROP POLICY IF EXISTS "uploads_authenticated_read_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_update_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_delete_own" ON storage.objects;

CREATE POLICY "uploads_authenticated_read_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND owner_id = (select auth.uid()::text)
);

CREATE POLICY "uploads_authenticated_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

CREATE POLICY "uploads_authenticated_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND owner_id = (select auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'uploads'
  AND owner_id = (select auth.uid()::text)
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

CREATE POLICY "uploads_authenticated_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND owner_id = (select auth.uid()::text)
);
