const pg = require('pg');

const client = new pg.Client({
  host: 'db.gipqiaenzqaetnqvvrwa.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Update admin avatar to /avatars/norm-man-1.jpg
  await client.query(`
    UPDATE public.profiles 
    SET avatar_url = '/avatars/norm-man-1.jpg'
    WHERE email = 'tushrahul58@gmail.com' OR id = '79b19372-636a-493f-882c-81d6664de58e';
  `);

  await client.query(`
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{avatar_url}', '"/avatars/norm-man-1.jpg"')
    WHERE email = 'tushrahul58@gmail.com' OR id = '79b19372-636a-493f-882c-81d6664de58e';
  `);

  const prof = await client.query(`SELECT id, email, display_name, avatar_url, role FROM public.profiles WHERE email = 'tushrahul58@gmail.com'`);
  console.log('✅ Admin Profile Avatar Updated:', prof.rows[0]);

  // 2. Create PostgreSQL RPC for Admin Deleting a User
  // This will cascade delete ideas owned by the user, posts, idea_members, notifications, profile, and auth user.
  await client.query(`
    CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
    RETURNS jsonb AS $$
    DECLARE
      v_target_email text;
    BEGIN
      -- Safety check: ensure not deleting the super admin
      SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
      
      IF v_target_email IS NULL THEN
        SELECT email INTO v_target_email FROM public.profiles WHERE id = target_user_id;
      END IF;

      IF v_target_email = 'tushrahul58@gmail.com' THEN
        RAISE EXCEPTION 'Cannot delete the primary administrator account.';
      END IF;

      -- Delete notifications
      DELETE FROM public.notifications WHERE user_id = target_user_id;

      -- Delete post attachments from posts created by user
      DELETE FROM public.post_attachments WHERE post_id IN (
        SELECT id FROM public.posts WHERE user_id = target_user_id
      );

      -- Delete posts created by user
      DELETE FROM public.posts WHERE user_id = target_user_id;

      -- Delete idea memberships
      DELETE FROM public.idea_members WHERE user_id = target_user_id;

      -- Delete ideas owned by this user (and their posts and members)
      DELETE FROM public.post_attachments WHERE post_id IN (
        SELECT p.id FROM public.posts p JOIN public.ideas i ON p.idea_id = i.id WHERE i.owner_id = target_user_id
      );
      DELETE FROM public.posts WHERE idea_id IN (
        SELECT id FROM public.ideas WHERE owner_id = target_user_id
      );
      DELETE FROM public.idea_members WHERE idea_id IN (
        SELECT id FROM public.ideas WHERE owner_id = target_user_id
      );
      DELETE FROM public.ideas WHERE owner_id = target_user_id;

      -- Delete profile
      DELETE FROM public.profiles WHERE id = target_user_id;

      -- Delete from auth.users
      DELETE FROM auth.users WHERE id = target_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'deleted_user_id', target_user_id,
        'deleted_email', v_target_email
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);

  console.log('✅ admin_delete_user RPC created successfully.');

  // 3. Make sure public.get_admin_stats returns ideas with creator details
  await client.query(`
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
      v_users_json jsonb;
      v_ideas_json jsonb;
    BEGIN
      -- Basic Counts
      SELECT count(*) INTO v_users_count FROM public.profiles;
      SELECT count(*) INTO v_ideas_count FROM public.ideas;
      SELECT count(*) INTO v_posts_count FROM public.posts;
      SELECT count(*) INTO v_members_count FROM public.idea_members;
      SELECT count(*) INTO v_attachments_count FROM public.post_attachments;

      -- Storage stats from storage.objects
      SELECT 
        COALESCE(sum(COALESCE((metadata->>'size')::bigint, 0)), 0),
        count(*),
        COALESCE(sum(CASE WHEN metadata->>'mimetype' LIKE 'image/%' THEN (metadata->>'size')::bigint ELSE 0 END), 0),
        COALESCE(sum(CASE WHEN metadata->>'mimetype' LIKE 'audio/%' THEN (metadata->>'size')::bigint ELSE 0 END), 0),
        COALESCE(sum(CASE WHEN metadata->>'mimetype' NOT LIKE 'image/%' AND metadata->>'mimetype' NOT LIKE 'audio/%' THEN (metadata->>'size')::bigint ELSE 0 END), 0)
      INTO 
        v_total_storage_bytes,
        v_storage_files_count,
        v_images_bytes,
        v_audio_bytes,
        v_doc_bytes
      FROM storage.objects
      WHERE bucket_id = 'attachments';

      -- Fallback to post_attachments if storage.objects is empty
      IF v_total_storage_bytes = 0 AND v_attachments_count > 0 THEN
        SELECT 
          COALESCE(sum(COALESCE(file_size, 0)), 0),
          count(*),
          COALESCE(sum(CASE WHEN file_type = 'image' THEN file_size ELSE 0 END), 0),
          COALESCE(sum(CASE WHEN file_type = 'audio' THEN file_size ELSE 0 END), 0),
          COALESCE(sum(CASE WHEN file_type NOT IN ('image', 'audio') THEN file_size ELSE 0 END), 0)
        INTO 
          v_total_storage_bytes,
          v_storage_files_count,
          v_images_bytes,
          v_audio_bytes,
          v_doc_bytes
        FROM public.post_attachments;
      END IF;

      -- Enriched Users List
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'role', u.role,
          'created_at', u.created_at,
          'ideas_count', (SELECT count(*) FROM public.ideas i WHERE i.owner_id = u.id),
          'posts_count', (SELECT count(*) FROM public.posts p WHERE p.user_id = u.id)
        ) ORDER BY u.created_at DESC
      ) INTO v_users_json
      FROM public.profiles u;

      -- Enriched Ideas with Creator Details
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'title', i.title,
          'description', i.description,
          'cover_url', i.cover_url,
          'color_theme', i.color_theme,
          'created_at', i.created_at,
          'updated_at', i.updated_at,
          'owner_id', i.owner_id,
          'owner_name', COALESCE(p.display_name, 'Unknown'),
          'owner_email', COALESCE(p.email, 'unknown@example.com'),
          'owner_avatar', COALESCE(p.avatar_url, ''),
          'posts_count', (SELECT count(*) FROM public.posts po WHERE po.idea_id = i.id),
          'members_count', (SELECT count(*) FROM public.idea_members im WHERE im.idea_id = i.id) + 1
        ) ORDER BY i.created_at DESC
      ) INTO v_ideas_json
      FROM public.ideas i
      LEFT JOIN public.profiles p ON i.owner_id = p.id;

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
        'storage_limit_bytes', 1073741824, -- 1 GB free tier
        'users', COALESCE(v_users_json, '[]'::jsonb),
        'ideas', COALESCE(v_ideas_json, '[]'::jsonb),
        'tables', jsonb_build_array(
          jsonb_build_object('name', 'profiles', 'count', v_users_count, 'description', 'User accounts & profiles'),
          jsonb_build_object('name', 'ideas', 'count', v_ideas_count, 'description', 'Idea workspaces & themes'),
          jsonb_build_object('name', 'idea_members', 'count', v_members_count, 'description', 'Idea member collaboration & roles'),
          jsonb_build_object('name', 'posts', 'count', v_posts_count, 'description', 'Discussions, messages & notes'),
          jsonb_build_object('name', 'post_attachments', 'count', v_attachments_count, 'description', 'Images, audio recordings, files'),
          jsonb_build_object('name', 'notifications', 'count', (SELECT count(*) FROM public.notifications), 'description', 'In-app activity alerts')
        )
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);

  console.log('✅ Updated get_admin_stats RPC with enriched ideas and creator details.');

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
