import pg from 'pg';
const { Client } = pg;

const sql = `
-- 1. Ensure columns on posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reply_to jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

-- 2. Post Reactions table
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT post_reactions_unique UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone" 
  ON public.post_reactions FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can insert own reactions" ON public.post_reactions;
CREATE POLICY "Users can insert own reactions" 
  ON public.post_reactions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.post_reactions;
CREATE POLICY "Users can delete own reactions" 
  ON public.post_reactions FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 3. Idea Reads table (for unread counts per user per idea)
CREATE TABLE IF NOT EXISTS public.idea_reads (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  last_read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, idea_id)
);

ALTER TABLE public.idea_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own idea reads" ON public.idea_reads;
CREATE POLICY "Users manage own idea reads" 
  ON public.idea_reads FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Publication for realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.idea_reads;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;

-- 5. Trigger on posts to automatically notify all idea members & owner
CREATE OR REPLACE FUNCTION public.handle_post_notification()
RETURNS trigger AS $$
DECLARE
  sender_name text;
  idea_title text;
  post_snippet text;
  recipient RECORD;
BEGIN
  -- Get sender display name
  SELECT coalesce(display_name, split_part(email, '@', 1), 'Someone') 
  INTO sender_name 
  FROM public.profiles 
  WHERE id = NEW.user_id;

  -- Get idea title
  SELECT title INTO idea_title FROM public.ideas WHERE id = NEW.idea_id;

  -- Create snippet
  post_snippet := coalesce(NEW.content, 'New attachment');
  IF length(post_snippet) > 80 THEN
    post_snippet := substring(post_snippet from 1 for 77) || '...';
  END IF;

  -- Do not notify if it's a silent system message or clear notification
  IF NEW.is_system = true THEN
    -- Broadcast notification about clearing messages
    FOR recipient IN (
      SELECT m.user_id FROM public.idea_members m WHERE m.idea_id = NEW.idea_id AND m.user_id != NEW.user_id
      UNION
      SELECT i.owner_id FROM public.ideas i WHERE i.id = NEW.idea_id AND i.owner_id != NEW.user_id
    ) LOOP
      INSERT INTO public.notifications (user_id, idea_id, title, message, type)
      VALUES (
        recipient.user_id,
        NEW.idea_id,
        'Messages Cleared in "' || coalesce(idea_title, 'Idea') || '" 🧹',
        sender_name || ' cleared all their messages: "' || post_snippet || '"',
        'discussion'
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Notify all idea members (except sender)
  FOR recipient IN (
    SELECT m.user_id FROM public.idea_members m WHERE m.idea_id = NEW.idea_id AND m.user_id != NEW.user_id
    UNION
    SELECT i.owner_id FROM public.ideas i WHERE i.id = NEW.idea_id AND i.owner_id != NEW.user_id
  ) LOOP
    INSERT INTO public.notifications (user_id, idea_id, title, message, type)
    VALUES (
      recipient.user_id,
      NEW.idea_id,
      'New message in "' || coalesce(idea_title, 'Idea') || '" 💬',
      sender_name || ': "' || post_snippet || '"',
      'discussion'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_created_notify ON public.posts;
CREATE TRIGGER on_post_created_notify
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_notification();

-- 6. RPC: clear_user_idea_posts
CREATE OR REPLACE FUNCTION public.clear_user_idea_posts(target_idea_id uuid, target_user_id uuid, clear_reason text)
RETURNS void AS $$
DECLARE
  u_name text;
BEGIN
  -- Get user name
  SELECT coalesce(display_name, split_part(email, '@', 1), 'A member') INTO u_name FROM public.profiles WHERE id = target_user_id;
  
  -- Delete all posts by this user in this idea
  DELETE FROM public.posts WHERE idea_id = target_idea_id AND user_id = target_user_id;

  -- Insert a system notice post explaining reason
  INSERT INTO public.posts (idea_id, user_id, content, is_system)
  VALUES (
    target_idea_id, 
    target_user_id, 
    coalesce(u_name, 'A member') || ' cleared all their messages. Reason: "' || coalesce(clear_reason, 'No reason specified') || '"',
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
    await client.connect();
    console.log('Connected to PostgreSQL. Running migrations...');
    await client.query(sql);
    console.log('Migration for chat enhancements, reactions, and notifications completed successfully!');
    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
