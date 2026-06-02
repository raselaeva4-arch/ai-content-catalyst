
-- 1. Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_projects" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create default project
INSERT INTO public.projects (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Project', 'Project default berisi semua data yang sudah ada')
ON CONFLICT (id) DO NOTHING;

-- 3. Add project_id column to existing tables and backfill
ALTER TABLE public.knowledge_base ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
UPDATE public.knowledge_base SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
ALTER TABLE public.knowledge_base ALTER COLUMN project_id SET NOT NULL;
CREATE INDEX idx_kb_project ON public.knowledge_base(project_id);

ALTER TABLE public.transcripts ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
UPDATE public.transcripts SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
ALTER TABLE public.transcripts ALTER COLUMN project_id SET NOT NULL;
CREATE INDEX idx_transcripts_project ON public.transcripts(project_id);

ALTER TABLE public.saved_generations ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
UPDATE public.saved_generations SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
ALTER TABLE public.saved_generations ALTER COLUMN project_id SET NOT NULL;
CREATE INDEX idx_saved_gen_project ON public.saved_generations(project_id);

ALTER TABLE public.analyses ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
UPDATE public.analyses SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
ALTER TABLE public.analyses ALTER COLUMN project_id SET NOT NULL;
CREATE INDEX idx_analyses_project ON public.analyses(project_id);
