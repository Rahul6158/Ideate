import pg from 'pg';
const { Client } = pg;

const schemaSql = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  role text DEFAULT 'Product Designer',
  bio text DEFAULT 'Exploring new horizons and creating interactive experiences.',
  skills jsonb DEFAULT '["Ideation", "Product Strategy", "Brainstorming"]'::jsonb,
  website text DEFAULT '',
  github text DEFAULT '',
  twitter text DEFAULT '',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backfill profiles for existing auth users if any
INSERT INTO public.profiles (id, email, display_name, avatar_url)
SELECT 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'avatar_url', '/avatars/avatar-1.png')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger to auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  chosen_avatar text;
BEGIN
  chosen_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', '/avatars/avatar-1.png');
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    chosen_avatar
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = coalesce(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. IDEAS TABLE
CREATE TABLE IF NOT EXISTS public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_url text,
  color_theme text DEFAULT 'indigo',
  owner_id uuid NOT NULL,
  posts_count integer DEFAULT 0,
  members_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT ideas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3. IDEA_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.idea_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT idea_members_idea_id_user_id_key UNIQUE (idea_id, user_id)
);

-- 4. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 5. POST_ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint DEFAULT 0,
  storage_path text NOT NULL,
  duration_seconds numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES public.ideas(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text DEFAULT 'discussion',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES (Full access for authenticated users & permissive reading for collaboration)

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Ideas Policies
DROP POLICY IF EXISTS "Ideas viewable by authenticated users" ON public.ideas;
CREATE POLICY "Ideas viewable by authenticated users" 
  ON public.ideas FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create ideas" ON public.ideas;
CREATE POLICY "Authenticated users can create ideas" 
  ON public.ideas FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update ideas" ON public.ideas;
CREATE POLICY "Owners can update ideas" 
  ON public.ideas FOR UPDATE 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Owners can delete ideas" ON public.ideas;
CREATE POLICY "Owners can delete ideas" 
  ON public.ideas FOR DELETE 
  TO authenticated 
  USING (auth.uid() = owner_id);

-- Idea Members Policies
DROP POLICY IF EXISTS "Idea members viewable by authenticated" ON public.idea_members;
CREATE POLICY "Idea members viewable by authenticated" 
  ON public.idea_members FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert idea members" ON public.idea_members;
CREATE POLICY "Authenticated can insert idea members" 
  ON public.idea_members FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete idea members" ON public.idea_members;
CREATE POLICY "Authenticated can delete idea members" 
  ON public.idea_members FOR DELETE 
  TO authenticated 
  USING (true);

-- Posts Policies
DROP POLICY IF EXISTS "Posts viewable by authenticated" ON public.posts;
CREATE POLICY "Posts viewable by authenticated" 
  ON public.posts FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert posts" ON public.posts;
CREATE POLICY "Authenticated can insert posts" 
  ON public.posts FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete posts" ON public.posts;
CREATE POLICY "Authors can delete posts" 
  ON public.posts FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Post Attachments Policies
DROP POLICY IF EXISTS "Attachments viewable by authenticated" ON public.post_attachments;
CREATE POLICY "Attachments viewable by authenticated" 
  ON public.post_attachments FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert attachments" ON public.post_attachments;
CREATE POLICY "Authenticated can insert attachments" 
  ON public.post_attachments FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete attachments" ON public.post_attachments;
CREATE POLICY "Authenticated can delete attachments" 
  ON public.post_attachments FOR DELETE 
  TO authenticated 
  USING (true);

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" 
  ON public.notifications FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
CREATE POLICY "Users can update notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;
CREATE POLICY "Users can delete notifications" 
  ON public.notifications FOR DELETE 
  TO authenticated 
  USING (true);

-- 9. REALTIME PUBLICATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.idea_members;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;

-- 10. STORAGE BUCKET: idea-attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-attachments', 'idea-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies for idea-attachments bucket
DROP POLICY IF EXISTS "Public read idea-attachments" ON storage.objects;
CREATE POLICY "Public read idea-attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'idea-attachments');

DROP POLICY IF EXISTS "Authenticated upload idea-attachments" ON storage.objects;
CREATE POLICY "Authenticated upload idea-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'idea-attachments');

DROP POLICY IF EXISTS "Authenticated update idea-attachments" ON storage.objects;
CREATE POLICY "Authenticated update idea-attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'idea-attachments');

DROP POLICY IF EXISTS "Authenticated delete idea-attachments" ON storage.objects;
CREATE POLICY "Authenticated delete idea-attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'idea-attachments');
`;

async function run() {
  const client = new Client({
    host: 'db.gipqiaenzqaetnqvvrwa.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Running schema migrations...');
    await client.query(schemaSql);
    console.log('Schema migration completed successfully!');

    // Verify all tables created
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Created tables in public schema:', res.rows.map(r => r.table_name));

    // Verify buckets
    const bucketRes = await client.query(`SELECT id, name, public FROM storage.buckets;`);
    console.log('Storage buckets:', bucketRes.rows);

    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
