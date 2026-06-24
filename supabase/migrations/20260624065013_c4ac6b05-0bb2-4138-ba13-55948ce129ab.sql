
-- 1) PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) PROJECTS: add user_id, drop permissive policy, add proper RLS
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

DROP POLICY IF EXISTS public_all_projects ON public.projects;

REVOKE ALL ON public.projects FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

CREATE POLICY "projects_select_own" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id AND id <> '00000000-0000-0000-0000-000000000001'::uuid);

-- 3) Helper: project ownership check (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.owns_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = auth.uid());
$$;

-- 4) CHILD TABLES: FK + RLS via owns_project
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_base_project_id_fkey') THEN
    ALTER TABLE public.knowledge_base ADD CONSTRAINT knowledge_base_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcripts_project_id_fkey') THEN
    ALTER TABLE public.transcripts ADD CONSTRAINT transcripts_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_generations_project_id_fkey') THEN
    ALTER TABLE public.saved_generations ADD CONSTRAINT saved_generations_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analyses_project_id_fkey') THEN
    ALTER TABLE public.analyses ADD CONSTRAINT analyses_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kb_project_id ON public.knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON public.transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_gen_project_id ON public.saved_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON public.analyses(project_id);

REVOKE ALL ON public.knowledge_base, public.transcripts, public.saved_generations, public.analyses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base, public.transcripts, public.saved_generations, public.analyses TO authenticated;
GRANT ALL ON public.knowledge_base, public.transcripts, public.saved_generations, public.analyses TO service_role;

CREATE POLICY "kb_owner_all" ON public.knowledge_base FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY "transcripts_owner_all" ON public.transcripts FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY "saved_gen_owner_all" ON public.saved_generations FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY "analyses_owner_all" ON public.analyses FOR ALL TO authenticated USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));

-- updated_at triggers (if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated_at') THEN
    CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kb_updated_at') THEN
    CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transcripts_updated_at') THEN
    CREATE TRIGGER trg_transcripts_updated_at BEFORE UPDATE ON public.transcripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saved_gen_updated_at') THEN
    CREATE TRIGGER trg_saved_gen_updated_at BEFORE UPDATE ON public.saved_generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) REALTIME
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.knowledge_base REPLICA IDENTITY FULL;
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;
ALTER TABLE public.saved_generations REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.projects; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_base; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_generations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
