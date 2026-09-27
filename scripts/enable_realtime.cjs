const pg = require('pg');

const client = new pg.Client({
  host: 'db.gipqiaenzqaetnqvvrwa.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function enableRealtime() {
  await client.connect();

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
      END IF;
    END
    $$;
  `);

  const tables = ['ideas', 'idea_members', 'posts', 'post_attachments', 'notifications', 'profiles'];
  for (const t of tables) {
    try {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${t};`);
      console.log('Added to realtime:', t);
    } catch (e) {
      console.log('Table already in realtime or notice:', t, e.message);
    }
  }

  const res = await client.query(`
    SELECT schemaname, tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime';
  `);
  console.log('Tables in supabase_realtime:');
  console.table(res.rows);

  await client.end();
}

enableRealtime().catch(err => {
  console.error(err);
  process.exit(1);
});
