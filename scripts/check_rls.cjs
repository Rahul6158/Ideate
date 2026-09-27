const { Client } = require('pg');


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
  const res = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public';
  `);
  console.log('Tables RLS:', res.rows);
  const pol = await client.query(`
    SELECT tablename, policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `);
  console.log('Policies count:', pol.rows.length);
  for (const p of pol.rows) {
    console.log(`- ${p.tablename}: [${p.cmd}] ${p.policyname} (qual: ${p.qual})`);
  }

  // Check idea_members table rows
  const members = await client.query(`SELECT * FROM public.idea_members;`);
  console.log('Idea members count:', members.rows.length, members.rows);

  // Check ideas table rows
  const ideas = await client.query(`SELECT id, title, owner_id FROM public.ideas;`);
  console.log('Ideas count:', ideas.rows.length, ideas.rows);

  await client.end();
}

main().catch(console.error);
