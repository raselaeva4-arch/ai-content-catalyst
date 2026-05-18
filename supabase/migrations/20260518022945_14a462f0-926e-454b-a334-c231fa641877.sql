CREATE TABLE public.saved_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  main_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  secondary_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  article_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  source_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all saved_generations" ON public.saved_generations FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_saved_generations_updated_at
BEFORE UPDATE ON public.saved_generations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();