import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'db.gipqiaenzqaetnqvvrwa.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb AS $$
DECLARE
  v_users_count bigint;
  v_ideas_count bigint;
  v_posts_count bigint;
  v_members_count bigint;
  v_attachments_count bigint;
  v_total_storage_bytes bigint;
  v_storage_files_count bigint;
  v_images_bytes bigint;
  v_audio_bytes bigint;
  v_doc_bytes bigint;
  v_users jsonb;
  v_tables jsonb;
BEGIN
  -- Check counts
  SELECT count(*) INTO v_users_count FROM public.profiles;
  SELECT count(*) INTO v_ideas_count FROM public.ideas;
  SELECT count(*) INTO v_posts_count FROM public.posts;
  SELECT count(*) INTO v_members_count FROM public.idea_members;
  SELECT count(*) INTO v_attachments_count FROM public.post_attachments;

  -- Storage from storage.objects
  SELECT 
    count(*),
    coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0)
  INTO v_storage_files_count, v_total_storage_bytes
  FROM storage.objects;

  -- File breakdown from post_attachments
  SELECT coalesce(sum(file_size), 0) INTO v_images_bytes FROM public.post_attachments WHERE file_type = 'image';
  SELECT coalesce(sum(file_size), 0) INTO v_audio_bytes FROM public.post_attachments WHERE file_type = 'audio';
  SELECT coalesce(sum(file_size), 0) INTO v_doc_bytes FROM public.post_attachments WHERE file_type NOT IN ('image', 'audio');

  -- If storage.objects has files but attachments table has lower, ensure total_storage_bytes is at least the sum
  IF v_total_storage_bytes = 0 AND (v_images_bytes + v_audio_bytes + v_doc_bytes) > 0 THEN
    v_total_storage_bytes := (v_images_bytes + v_audio_bytes + v_doc_bytes);
  END IF;

  -- Users list with stats
  SELECT jsonb_agg(u) INTO v_users FROM (
    SELECT 
      p.id,
      p.email,
      p.display_name,
      p.avatar_url,
      p.role,
      p.created_at,
      count(DISTINCT i.id) as ideas_count,
      count(DISTINCT pst.id) as posts_count
    FROM public.profiles p
    LEFT JOIN public.ideas i ON i.owner_id = p.id
    LEFT JOIN public.posts pst ON pst.user_id = p.id
    GROUP BY p.id, p.email, p.display_name, p.avatar_url, p.role, p.created_at
    ORDER BY p.created_at DESC
  ) u;

  -- Database tables metadata
  v_tables := jsonb_build_array(
    jsonb_build_object('name', 'profiles', 'description', 'User accounts & profiles', 'count', v_users_count),
    jsonb_build_object('name', 'ideas', 'description', 'Idea workspaces & themes', 'count', v_ideas_count),
    jsonb_build_object('name', 'idea_members', 'description', 'Idea member collaboration & roles', 'count', v_members_count),
    jsonb_build_object('name', 'posts', 'description', 'Discussions, messages & notes', 'count', v_posts_count),
    jsonb_build_object('name', 'post_attachments', 'description', 'Images, audio recordings, files', 'count', v_attachments_count)
  );

  RETURN jsonb_build_object(
    'users_count', v_users_count,
    'ideas_count', v_ideas_count,
    'posts_count', v_posts_count,
    'members_count', v_members_count,
    'attachments_count', v_attachments_count,
    'total_storage_bytes', v_total_storage_bytes,
    'storage_files_count', v_storage_files_count,
    'images_bytes', v_images_bytes,
    'audio_bytes', v_audio_bytes,
    'doc_bytes', v_doc_bytes,
    'storage_limit_bytes', 1073741824, -- 1 GB Supabase free tier
    'users', coalesce(v_users, '[]'::jsonb),
    'tables', v_tables
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated, anon;
`;

async function main() {
  await client.connect();
  console.log('Creating get_admin_stats() function in Postgres...');
  await client.query(sql);
  console.log('Testing get_admin_stats()...');
  const res = await client.query('SELECT public.get_admin_stats() as stats;');
  console.log('ADMIN STATS OUTPUT:', JSON.stringify(res.rows[0].stats, null, 2));
  await client.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
