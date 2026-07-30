DROP POLICY IF EXISTS "public upload insert" ON storage.objects;

CREATE POLICY "uploads_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'uploads' AND owner_id = auth.uid()::text);

CREATE POLICY "uploads_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'uploads' AND owner_id = auth.uid()::text);

CREATE POLICY "uploads_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'uploads' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'uploads' AND owner_id = auth.uid()::text);

CREATE POLICY "uploads_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'uploads' AND owner_id = auth.uid()::text);