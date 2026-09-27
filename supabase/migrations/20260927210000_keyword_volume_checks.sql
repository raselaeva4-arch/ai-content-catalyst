CREATE TABLE IF NOT EXISTS public.keyword_volume_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kvc_project_idx
  ON public.keyword_volume_checks(project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_volume_checks TO authenticated;
GRANT ALL ON public.keyword_volume_checks TO service_role;

ALTER TABLE public.keyword_volume_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'keyword_volume_checks'
      AND policyname = 'kvc_owner_all'
  ) THEN
    CREATE POLICY kvc_owner_all
      ON public.keyword_volume_checks
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.id = keyword_volume_checks.project_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.id = keyword_volume_checks.project_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END
$$;