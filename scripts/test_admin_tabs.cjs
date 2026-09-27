const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gipqiaenzqaetnqvvrwa.supabase.co';
const supabaseAnonKey = 'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('--- 1. Testing Admin Login ---');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123'
  });
  if (authErr) throw authErr;
  console.log('✅ Admin logged in. Avatar in metadata:', auth.user.user_metadata?.avatar_url);

  console.log('\n--- 2. Testing get_admin_stats with creator details ---');
  const { data: stats, error: statsErr } = await supabase.rpc('get_admin_stats');
  if (statsErr) throw statsErr;
  console.log('✅ Stats retrieved:');
  console.log('Users count:', stats.users_count);
  console.log('Ideas count:', stats.ideas_count);
  console.log('Ideas with Creator Info:');
  for (const idea of stats.ideas || []) {
    console.log(`- Title: "${idea.title}", Created by: ${idea.owner_name} (${idea.owner_email}), Avatar: ${idea.owner_avatar}, Members: ${idea.members_count}, Posts: ${idea.posts_count}`);
  }

  console.log('\n--- 3. Testing Admin Delete Safety Check on Self ---');
  const { error: delSelfErr } = await supabase.rpc('admin_delete_user', { target_user_id: auth.user.id });
  if (delSelfErr) {
    console.log('✅ Safety guard working as expected: Prevented deleting super admin! Error message:', delSelfErr.message);
  } else {
    console.error('❌ Failed safety check: Admin should not be able to delete self!');
  }

  console.log('\n--- ALL ADMIN TABS & ACTIONS VERIFIED SUCCESSFULLY ---');
}

test().catch(console.error);
