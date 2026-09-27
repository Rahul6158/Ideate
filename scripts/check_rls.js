const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: 'postgresql://postgres:Tushar%40123@db.gipqiaenzqaetnqvvrwa.supabase.co:5432/postgres',
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
  await client.end();
}

main().catch(console.error);
