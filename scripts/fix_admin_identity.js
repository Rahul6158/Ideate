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

  console.log('Fixing null strings in auth.users for admin...');
  await client.query(`
    UPDATE auth.users
    SET 
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      phone_change = '',
      phone_change_token = '',
      email_change_token_current = '',
      reauthentication_token = '',
      phone_change_sent_at = null,
      banned_until = null,
      reauthentication_sent_at = null,
      email_change_confirm_status = 0,
      raw_user_meta_data = jsonb_build_object(
        'sub', '79b19372-636a-493f-882c-81d6664de58e',
        'email', 'tushrahul58@gmail.com',
        'display_name', 'admin',
        'role', 'admin',
        'avatar_url', '/avatars/cyber-hacker.avif',
        'email_verified', true,
        'phone_verified', false
      )
    WHERE email = 'tushrahul58@gmail.com';
  `);

  await client.query(`
    UPDATE auth.identities
    SET identity_data = jsonb_build_object(
      'sub', '79b19372-636a-493f-882c-81d6664de58e',
      'email', 'tushrahul58@gmail.com',
      'display_name', 'admin',
      'role', 'admin',
      'avatar_url', '/avatars/cyber-hacker.avif',
      'email_verified', true,
      'phone_verified', false
    )
    WHERE email = 'tushrahul58@gmail.com';
  `);

  await client.end();

  console.log('Testing Supabase login with tushrahul58@gmail.com and Admin@123...');
  const supabase = createClient(
    'https://gipqiaenzqaetnqvvrwa.supabase.co',
    'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88'
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123'
  });

  if (error) {
    console.error('Login error:', error.message);
  } else {
    console.log('SUCCESS! Admin logged in successfully! User ID:', data.user.id, 'Email:', data.user.email);
  }
}

main().catch(console.error);
