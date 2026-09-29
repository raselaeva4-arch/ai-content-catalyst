-- Track the Knowledge Base sources used to generate each article.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS knowledge_base_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_base_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS articles_knowledge_base_ids_gin
  ON public.articles USING GIN (knowledge_base_ids);
