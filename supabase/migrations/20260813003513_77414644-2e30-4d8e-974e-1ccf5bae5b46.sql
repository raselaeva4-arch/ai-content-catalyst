CREATE TABLE public.article_reworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  source_type text NOT NULL DEFAULT 'paste',
  source_path text,
  source_name text,
  source_mime text,
  original_content text NOT NULL DEFAULT '',
  revision_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision_notes_text text NOT NULL DEFAULT '',
  manual_prompt text NOT NULL DEFAULT '',
  reworked_content text NOT NULL DEFAULT '',
  reworked_title text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  crosscheck jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_reworks TO authenticated;
GRANT ALL ON public.article_reworks TO service_role;

ALTER TABLE public.article_reworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY article_reworks_owner_all ON public.article_reworks
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = article_reworks.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = article_reworks.project_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_article_reworks_updated_at
BEFORE UPDATE ON public.article_reworks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_article_reworks_project ON public.article_reworks(project_id, created_at DESC);