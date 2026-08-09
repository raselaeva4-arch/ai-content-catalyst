-- analyses
DROP POLICY IF EXISTS analyses_owner_all ON public.analyses;
CREATE POLICY analyses_owner_all ON public.analyses FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = auth.uid()));

-- articles
DROP POLICY IF EXISTS articles_owner_all ON public.articles;
CREATE POLICY articles_owner_all ON public.articles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = articles.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = articles.project_id AND p.user_id = auth.uid()));

-- knowledge_base
DROP POLICY IF EXISTS kb_owner_all ON public.knowledge_base;
CREATE POLICY kb_owner_all ON public.knowledge_base FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = knowledge_base.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = knowledge_base.project_id AND p.user_id = auth.uid()));

-- saved_generations
DROP POLICY IF EXISTS saved_gen_owner_all ON public.saved_generations;
CREATE POLICY saved_gen_owner_all ON public.saved_generations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = saved_generations.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = saved_generations.project_id AND p.user_id = auth.uid()));

-- transcripts
DROP POLICY IF EXISTS transcripts_owner_all ON public.transcripts;
CREATE POLICY transcripts_owner_all ON public.transcripts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = transcripts.project_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = transcripts.project_id AND p.user_id = auth.uid()));

-- remove the SECURITY DEFINER helper that was callable by signed-in users
DROP FUNCTION IF EXISTS public.owns_project(uuid);

-- trigger-only SECURITY DEFINER function should not be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;