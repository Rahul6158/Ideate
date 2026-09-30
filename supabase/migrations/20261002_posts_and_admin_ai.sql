-- ==============================================================================
-- Migration: Add missing columns to posts, update RLS for AI & Admin Access
-- ==============================================================================

-- 1. Add missing extended columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sender_type text DEFAULT 'user';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS agent_name text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reply_to jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS ai_metadata jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

-- 2. Create idea_ai_access table if it does not exist
CREATE TABLE IF NOT EXISTS public.idea_ai_access (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  idea_id uuid REFERENCES public.ideas(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_use_ai boolean DEFAULT true NOT NULL,
  is_ai_enabled boolean DEFAULT true NOT NULL,
  is_paused_by_admin boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(idea_id, user_id)
);

ALTER TABLE public.idea_ai_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read idea_ai_access"
  ON public.idea_ai_access FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write idea_ai_access"
  ON public.idea_ai_access FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Update user_has_idea_access helper function to support Admins
CREATE OR REPLACE FUNCTION public.user_has_idea_access(lookup_idea_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR email = 'tushrahul58@gmail.com')
  ) OR EXISTS (
    SELECT 1 FROM public.ideas WHERE id = lookup_idea_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.idea_members WHERE idea_id = lookup_idea_id AND user_id = auth.uid()
  );
$$;

-- 4. Update posts insert policy to allow AI posts and admin posts
DROP POLICY IF EXISTS "Authorized users can insert posts" ON public.posts;
CREATE POLICY "Authorized users can insert posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_idea_access(idea_id)
  );

-- 5. Update posts view policy
DROP POLICY IF EXISTS "Users can view posts for ideas they have access to" ON public.posts;
CREATE POLICY "Users can view posts for ideas they have access to"
  ON public.posts FOR SELECT
  TO authenticated
  USING (public.user_has_idea_access(idea_id));
