-- Security hardening for the public Data API and Storage.
-- The application server uses service_role, so these RLS policies protect direct
-- browser/API access without blocking trusted server functions.
--
-- Scope:
-- 1. Profiles (email/display name/avatar) are visible only to the signed-in user.
-- 2. Projects are private to their owner.
-- 3. Project-owned content is private to the owner of the parent project.
-- 4. Portal tools are private to their user.
-- 5. uploads is private and each object must live under <auth.uid>/...

-- ---------------------------------------------------------------------------
-- PROFILES: personal data
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (select auth.uid()));

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = (select auth.uid()));

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PROJECTS: owner-only
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_public_select" ON public.projects;
DROP POLICY IF EXISTS "projects_public_all" ON public.projects;
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

CREATE POLICY "projects_select_own"
ON public.projects
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

CREATE POLICY "projects_insert_own"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "projects_update_own"
ON public.projects
FOR UPDATE
TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "projects_delete_own"
ON public.projects
FOR DELETE
TO authenticated
USING (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PROJECT-OWNED TABLES
-- ---------------------------------------------------------------------------

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_revision_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_volume_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Remove known permissive/public policies created by earlier versions.
DROP POLICY IF EXISTS "public all analyses" ON public.analyses;
DROP POLICY IF EXISTS "public all kb" ON public.knowledge_base;
DROP POLICY IF EXISTS "public all saved_generations" ON public.saved_generations;
DROP POLICY IF EXISTS "analyses_public_all" ON public.analyses;
DROP POLICY IF EXISTS "article_reworks_public_all" ON public.article_reworks;
DROP POLICY IF EXISTS "articles_public_all" ON public.articles;
DROP POLICY IF EXISTS "doc_revision_notes_public_all" ON public.doc_revision_notes;
DROP POLICY IF EXISTS "keyword_volume_checks_public_all" ON public.keyword_volume_checks;
DROP POLICY IF EXISTS "knowledge_base_public_all" ON public.knowledge_base;
DROP POLICY IF EXISTS "saved_generations_public_all" ON public.saved_generations;
DROP POLICY IF EXISTS "transcripts_public_all" ON public.transcripts;

-- Each child row is accessible only when its project belongs to the caller.
-- Service-role server functions bypass RLS; direct browser access does not.

CREATE POLICY "analyses_owner_access"
ON public.analyses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = analyses.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = analyses.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "article_reworks_owner_access"
ON public.article_reworks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = article_reworks.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = article_reworks.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "articles_owner_access"
ON public.articles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = articles.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = articles.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "doc_revision_notes_owner_access"
ON public.doc_revision_notes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = doc_revision_notes.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = doc_revision_notes.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "keyword_volume_checks_owner_access"
ON public.keyword_volume_checks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = keyword_volume_checks.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = keyword_volume_checks.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "knowledge_base_owner_access"
ON public.knowledge_base
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = knowledge_base.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = knowledge_base.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "saved_generations_owner_access"
ON public.saved_generations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = saved_generations.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = saved_generations.project_id
      AND p.user_id = (select auth.uid())
  )
);

CREATE POLICY "transcripts_owner_access"
ON public.transcripts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = transcripts.project_id
      AND p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = transcripts.project_id
      AND p.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- PORTAL TOOLS: user-specific data
-- ---------------------------------------------------------------------------

ALTER TABLE public.portal_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_tools_public_select" ON public.portal_tools;
DROP POLICY IF EXISTS "portal_tools_public_all" ON public.portal_tools;
DROP POLICY IF EXISTS "portal_tools_owner_access" ON public.portal_tools;

CREATE POLICY "portal_tools_owner_access"
ON public.portal_tools
FOR ALL
TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- UPLOADS: private, per-user object paths
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id = 'uploads';

DROP POLICY IF EXISTS "public upload read" ON storage.objects;
DROP POLICY IF EXISTS "public upload insert" ON storage.objects;
DROP POLICY IF EXISTS "public upload delete" ON storage.objects;
DROP POLICY IF EXISTS "public upload update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_delete" ON storage.objects;

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
