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

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  console.log('1. Auto-confirming all existing users in auth.users...');
  await client.query(`
    UPDATE auth.users 
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE email_confirmed_at IS NULL;
  `);

  console.log('2. Creating trigger to auto-confirm all future signups...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
    RETURNS trigger AS $$
    BEGIN
      NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
    CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();
  `);

  console.log('3. Ensuring role column in profiles and admin policies...');
  await client.query(`
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'Member';
  `);

  console.log('4. Creating or updating Admin account: tushrahul58@gmail.com...');
  const existing = await client.query(`SELECT id, email FROM auth.users WHERE lower(email) = 'tushrahul58@gmail.com'`);
  let adminId;

  if (existing.rows.length > 0) {
    adminId = existing.rows[0].id;
    console.log('Updating existing admin user password and metadata...');
    await client.query(`
      UPDATE auth.users
      SET 
        encrypted_password = crypt('Admin@123', gen_salt('bf')),
        email_confirmed_at = now(),
        raw_user_meta_data = jsonb_build_object(
          'display_name', 'admin',
          'role', 'admin',
          'avatar_url', '/avatars/cyber-hacker.avif'
        )
      WHERE id = $1;
    `, [adminId]);
  } else {
    console.log('Inserting new admin user into auth.users...');
    const insertRes = await client.query(`
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'tushrahul58@gmail.com',
        crypt('Admin@123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"admin","role":"admin","avatar_url":"/avatars/cyber-hacker.avif"}'::jsonb,
        now(),
        now()
      ) RETURNING id;
    `);
    adminId = insertRes.rows[0].id;
  }

  console.log('5. Upserting admin profile in public.profiles...');
  await client.query(`
    INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
    VALUES ($1, 'tushrahul58@gmail.com', 'admin', '/avatars/cyber-hacker.avif', 'admin')
    ON CONFLICT (id) DO UPDATE SET
      display_name = 'admin',
      role = 'admin',
      avatar_url = '/avatars/cyber-hacker.avif',
      updated_at = now();
  `, [adminId]);

  console.log('Admin user setup successfully! ID:', adminId);

  // Storage Stats Check
  const storageFiles = await client.query(`
    SELECT 
      count(*) as total_files, 
      coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0) as total_bytes
    FROM storage.objects;
  `);
  console.log('STORAGE STATS:', storageFiles.rows[0]);

  // Profiles list
  const profs = await client.query(`SELECT id, email, display_name, role FROM public.profiles`);
  console.log('ALL PROFILES NOW:', profs.rows);

  await client.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
