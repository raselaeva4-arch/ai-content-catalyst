
CREATE TABLE public.transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'url',
  source_url TEXT,
  source_path TEXT,
  platform TEXT,
  mime TEXT,
  transcript TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_transcripts_updated_at
BEFORE UPDATE ON public.transcripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_transcripts_created_at ON public.transcripts(created_at DESC);
