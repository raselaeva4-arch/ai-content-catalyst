
-- Knowledge base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('playbook','persona','knowledge')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analyses table
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Single-user mode: public access (no auth)
CREATE POLICY "public all kb" ON public.knowledge_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all analyses" ON public.analyses FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads','uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public upload read" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "public upload insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "public upload delete" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');
