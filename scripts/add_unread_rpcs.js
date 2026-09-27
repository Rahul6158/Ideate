import pg from 'pg';
const { Client } = pg;

const sql = `
CREATE OR REPLACE FUNCTION public.get_user_unread_counts(target_user_id uuid)
RETURNS TABLE (idea_id uuid, unread_count bigint) AS $$
BEGIN
  RETURN QUERY
  WITH user_ideas AS (
    SELECT id AS idea_id FROM public.ideas WHERE owner_id = target_user_id
    UNION
    SELECT m.idea_id FROM public.idea_members m WHERE m.user_id = target_user_id
  ),
  user_reads AS (
    SELECT r.idea_id, r.last_read_at
    FROM public.idea_reads r
    WHERE r.user_id = target_user_id
  )
  SELECT 
    ui.idea_id,
    COUNT(p.id) AS unread_count
  FROM user_ideas ui
  LEFT JOIN user_reads ur ON ur.idea_id = ui.idea_id
  LEFT JOIN public.posts p ON p.idea_id = ui.idea_id 
    AND p.user_id != target_user_id 
    AND p.created_at > coalesce(ur.last_read_at, '1970-01-01'::timestamptz)
    AND p.is_system IS NOT TRUE
  GROUP BY ui.idea_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_idea_as_read(target_user_id uuid, target_idea_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.idea_reads (user_id, idea_id, last_read_at)
  VALUES (target_user_id, target_idea_id, now())
  ON CONFLICT (user_id, idea_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
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
    await client.query(sql);
    console.log('get_user_unread_counts and mark_idea_as_read created successfully!');
    await client.end();
  } catch (err) {
    console.error('Error creating RPCs:', err);
    process.exit(1);
  }
}

run();
