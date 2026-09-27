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

  console.log('Setting up auto-confirm trigger on auth.users...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
    RETURNS trigger AS $$
    BEGIN
      NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
      NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
      NEW.recovery_token := COALESCE(NEW.recovery_token, '');
      NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
      NEW.email_change := COALESCE(NEW.email_change, '');
      NEW.phone_change := COALESCE(NEW.phone_change, '');
      NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
      NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
      NEW.reauthentication_token := COALESCE(NEW.reauthentication_token, '');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
    CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();
  `);

  console.log('Trigger installed. Now testing login with existing user tushrahul2003@gmail.com...');
  // Check password for tushrahul2003@gmail.com
  const { data: testData, error: testError } = await supabase.auth.signInWithPassword({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123'
  });
  console.log('Admin login with trigger present:', testError ? testError.message : 'SUCCESS');

  await client.end();
}

main().catch(console.error);
