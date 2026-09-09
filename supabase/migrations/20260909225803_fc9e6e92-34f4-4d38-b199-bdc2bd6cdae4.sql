CREATE TABLE public.portal_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_tools TO authenticated;
GRANT ALL ON public.portal_tools TO service_role;

ALTER TABLE public.portal_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own portal tools" ON public.portal_tools
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_portal_tools_updated_at
  BEFORE UPDATE ON public.portal_tools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();