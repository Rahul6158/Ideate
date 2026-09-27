import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gipqiaenzqaetnqvvrwa.supabase.co',
  'sb_publishable_Z2rphL-WmJp1dplIQbJvcQ_lEJM8Z88'
);

async function main() {
  const currentUserId = '176f7d0f-462e-42ee-8f2e-f1d3a879c0ef';
  const { data, error } = await supabase
    .from('ideas')
    .select(`
      *,
      owner:profiles!ideas_owner_id_fkey(id, email, display_name, avatar_url),
      idea_members(user_id, role),
      posts(id)
    `);

  console.log('Query Error:', error);
  console.log('Returned Ideas count:', data?.length);
  if (data) {
    data.forEach(item => {
      const isOwner = item.owner_id === currentUserId;
      const isMember = item.idea_members?.some(m => m.user_id === currentUserId);
      console.log('Title:', item.title, 'isOwner:', isOwner, 'isMember:', isMember, 'idea_members:', item.idea_members);
    });
  }
}

main().catch(console.error);
