const { createClient } = require('@supabase/supabase-js');
const pg = require('pg');

const supabaseUrl = 'https://gipqiaenzqaetnqvvrwa.supabase.co';
const supabaseAnonKey = 'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFlow() {
  console.log('=== TEST 1: Admin Authentication ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'tushrahul58@gmail.com',
    password: 'Admin@123'
  });

  if (authError) {
    console.error('❌ Admin login failed:', authError.message);
  } else {
    console.log('✅ Admin login succeeded! User ID:', authData.user.id, 'Email:', authData.user.email);
  }

  console.log('\n=== TEST 2: Admin Stats RPC (Supabase Storage & DB Tables) ===');
  const { data: statsData, error: statsError } = await supabase.rpc('get_admin_stats');
  if (statsError) {
    console.error('❌ get_admin_stats RPC error:', statsError.message);
  } else {
    console.log('✅ Admin stats retrieved successfully:');
    console.log(JSON.stringify(statsData, null, 2));
  }

  console.log('\n=== TEST 3: Instant Registered User Search ===');
  const { data: searchResults, error: searchError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, role')
    .or(`email.ilike.%tush%,display_name.ilike.%tush%`)
    .limit(5);

  if (searchError) {
    console.error('❌ User search error:', searchError.message);
  } else {
    console.log('✅ Found', searchResults.length, 'registered accounts matching "tush":');
    console.table(searchResults);
  }

  console.log('\n=== TEST 4: Add Member To Idea ===');
  // Get an existing idea
  const { data: ideas } = await supabase.from('ideas').select('id, title, owner_id').limit(1);
  if (ideas && ideas.length > 0) {
    const idea = ideas[0];
    console.log('Found idea:', idea.title, 'ID:', idea.id);

    // Pick a member to add (e.g. RajKrish - tushrahul2003@gmail.com)
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('email', 'tushrahul2003@gmail.com')
      .single();

    if (targetProfile) {
      console.log('Adding collaborator:', targetProfile.display_name, targetProfile.email);
      const { data: memberInsert, error: memberErr } = await supabase
        .from('idea_members')
        .upsert({
          idea_id: idea.id,
          user_id: targetProfile.id,
          role: 'member'
        })
        .select()
        .single();

      if (memberErr) {
        console.error('❌ Member insertion error:', memberErr.message);
      } else {
        console.log('✅ Collaborator added successfully to idea!', memberInsert);
      }
    }
  }

  console.log('\n=== TEST 5: Verify Query For Added Member ===');
  // Check idea_members with profiles join
  const { data: members, error: memErr } = await supabase
    .from('idea_members')
    .select(`
      id,
      role,
      idea_id,
      profiles:user_id(id, email, display_name)
    `);

  if (memErr) {
    console.error('❌ Error fetching idea_members:', memErr.message);
  } else {
    console.log('✅ Current idea_members in DB:');
    console.table(members.map(m => ({
      member_id: m.id,
      role: m.role,
      user_email: m.profiles?.email,
      user_name: m.profiles?.display_name
    })));
  }

  console.log('\n=== ALL TESTS FINISHED ===');
}

testFlow().catch(console.error);
