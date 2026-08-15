CREATE TABLE public.doc_revision_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_id text,
  doc_name text,
  doc_url text,
  section text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  author text,
  commented_at timestamptz,
  resolved boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_revision_notes TO authenticated;
GRANT ALL ON public.doc_revision_notes TO service_role;

ALTER TABLE public.doc_revision_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_revision_notes_owner_all ON public.doc_revision_notes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = doc_revision_notes.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = doc_revision_notes.project_id AND p.user_id = auth.uid()));

CREATE INDEX idx_doc_revision_notes_project ON public.doc_revision_notes(project_id, created_at DESC);

CREATE TRIGGER trg_doc_revision_notes_updated_at BEFORE UPDATE ON public.doc_revision_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();