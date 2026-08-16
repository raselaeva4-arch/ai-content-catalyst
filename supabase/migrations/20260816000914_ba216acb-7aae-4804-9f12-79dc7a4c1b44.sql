ALTER TABLE public.doc_revision_notes
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_result text;