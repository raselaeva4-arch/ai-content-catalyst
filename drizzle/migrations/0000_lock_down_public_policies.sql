DROP POLICY IF EXISTS projects_public_select ON public.projects;
DROP POLICY IF EXISTS portal_tools_public_select ON public.portal_tools;
DROP POLICY IF EXISTS uploads_public_select ON storage.objects;
DROP POLICY IF EXISTS uploads_public_update ON storage.objects;
DROP POLICY IF EXISTS uploads_public_delete ON storage.objects;