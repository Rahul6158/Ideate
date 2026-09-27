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
  const id1 = (await client.query(`SELECT * FROM auth.identities WHERE email = 'tusharahul82@gmail.com'`)).rows[0];
  const id2 = (await client.query(`SELECT * FROM auth.identities WHERE email = 'tushrahul58@gmail.com'`)).rows[0];
  console.log('ID1 (working user):', id1);
  console.log('ID2 (admin user):', id2);
  await client.end();
}
main().catch(console.error);
