const pg = require('pg');

const client = new pg.Client({
  host: 'db.gipqiaenzqaetnqvvrwa.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function sync() {
  await client.connect();

  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', CASE WHEN NEW.email = 'tushrahul58@gmail.com' THEN 'admin' ELSE 'member' END)
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
        role = CASE WHEN EXCLUDED.email = 'tushrahul58@gmail.com' THEN 'admin' ELSE public.profiles.role END;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  `);

  const users = await client.query('SELECT id, email, raw_user_meta_data FROM auth.users');
  for (const u of users.rows) {
    const meta = u.raw_user_meta_data || {};
    const name = meta.display_name || meta.full_name || u.email.split('@')[0];
    const role = (u.email === 'tushrahul58@gmail.com') ? 'admin' : (meta.role || 'member');
    await client.query(`
      INSERT INTO public.profiles (id, email, display_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role;
    `, [u.id, u.email, name, role]);
  }

  // Ensure admin email is exactly tushrahul58@gmail.com
  await client.query(`
    UPDATE public.profiles
    SET email = 'tushrahul58@gmail.com', display_name = 'admin', role = 'admin'
    WHERE id = '79b19372-636a-493f-882c-81d6664de58e';
  `);

  const profs = await client.query('SELECT id, email, display_name, role FROM public.profiles');
  console.log('Successfully Synchronized Profiles in DB:');
  console.table(profs.rows);

  await client.end();
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
