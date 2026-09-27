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

const supabase = createClient(
  'https://gipqiaenzqaetnqvvrwa.supabase.co',
  'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88'
);

async function main() {
  await client.connect();
  console.log('1. Dropping any custom triggers on auth.users...');
  await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;`);
  
  console.log('2. Removing manually inserted admin from auth.users & identities if broken...');
  await client.query(`DELETE FROM auth.identities WHERE email = 'tushrahul58@gmail.com';`);
  await client.query(`DELETE FROM auth.users WHERE email = 'tushrahul58@gmail.com';`);
  await client.query(`DELETE FROM public.profiles WHERE email = 'tushrahul58@gmail.com';`);

  console.log('3. Signing up tushrahul58@gmail.com via Supabase Auth API...');
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123',
    options: {
      data: {
        display_name: 'admin',
        role: 'admin',
        avatar_url: '/avatars/cyber-hacker.avif'
      }
    }
  });

  if (signupError) {
    console.error('Signup error:', signupError);
  } else {
    console.log('Signup success! User ID:', signupData.user?.id);
  }

  console.log('4. Auto-confirming tushrahul58@gmail.com in database...');
  await client.query(`
    UPDATE auth.users
    SET email_confirmed_at = now()
    WHERE email = 'tushrahul58@gmail.com';
  `);

  await client.query(`
    INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
    SELECT id, email, 'admin', '/avatars/cyber-hacker.avif', 'admin'
    FROM auth.users WHERE email = 'tushrahul58@gmail.com'
    ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'admin';
  `);

  console.log('5. Testing Supabase signInWithPassword for admin...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123'
  });

  if (loginError) {
    console.error('Login error:', loginError.message);
  } else {
    console.log('SUCCESS! Admin logged in perfectly! User ID:', loginData.user.id, 'Session:', !!loginData.session);
  }

  await client.end();
}

main().catch(console.error);
