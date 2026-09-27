import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

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

  const adminId = '79b19372-636a-493f-882c-81d6664de58e';
  const email = 'tushrahul58@gmail.com';

  console.log('Inserting into auth.users...');
  await client.query(`
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
      updated_at,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      '${adminId}',
      'authenticated',
      'authenticated',
      '${email}',
      crypt('Admin@123', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"sub":"${adminId}","email":"${email}","display_name":"admin","role":"admin","avatar_url":"/avatars/cyber-hacker.avif","email_verified":true}'::jsonb,
      now(),
      now(),
      false,
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt('Admin@123', gen_salt('bf', 10)),
      email_confirmed_at = now();
  `);

  console.log('Inserting into auth.identities...');
  await client.query(`
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      '${adminId}',
      '${adminId}',
      '{"sub":"${adminId}","email":"${email}","display_name":"admin","role":"admin","avatar_url":"/avatars/cyber-hacker.avif","email_verified":true}'::jsonb,
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  `);

  console.log('Inserting into public.profiles...');
  await client.query(`
    INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
    VALUES ('${adminId}', '${email}', 'admin', '/avatars/cyber-hacker.avif', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'admin';
  `);

  await client.end();

  console.log('Testing login with Supabase Client...');
  const supabase = createClient(
    'https://gipqiaenzqaetnqvvrwa.supabase.co',
    'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88'
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'Admin@123'
  });

  if (error) {
    console.error('Login error:', error);
  } else {
    console.log('SUCCESSFUL ADMIN LOGIN! User:', data.user.email, 'Role:', data.user.user_metadata?.role);
  }
}

main().catch(console.error);
