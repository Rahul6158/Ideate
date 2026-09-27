import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';

export const adminService = {
  async getAdminStats() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_admin_stats');
        if (!error && data) {
          const totalBytes = Number(data.total_storage_bytes || 0);
          const limitBytes = Number(data.storage_limit_bytes || 1073741824); // 1 GB free tier
          const percentageUsed = Math.min(100, (totalBytes / limitBytes) * 100);

          return {
            ...data,
            total_storage_bytes: totalBytes,
            storage_limit_bytes: limitBytes,
            percentage_used: percentageUsed,
            storage_mb_used: (totalBytes / (1024 * 1024)).toFixed(2),
            storage_mb_limit: (limitBytes / (1024 * 1024)).toFixed(0),
            storage_remaining_mb: (Math.max(0, limitBytes - totalBytes) / (1024 * 1024)).toFixed(2),
            images_mb: (Number(data.images_bytes || 0) / (1024 * 1024)).toFixed(2),
            audio_mb: (Number(data.audio_bytes || 0) / (1024 * 1024)).toFixed(2),
            doc_mb: (Number(data.doc_bytes || 0) / (1024 * 1024)).toFixed(2),
            ideas: data.ideas || [],
            users: data.users || []
          };
        }
      } catch (err) {
        console.warn('RPC get_admin_stats error, using table aggregation fallback:', err.message);
      }

      // Direct fallback via client tables
      try {
        const [profilesRes, ideasRes, postsRes, membersRes, attachmentsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('ideas').select('*, owner:profiles!ideas_owner_id_fkey(id, email, display_name, avatar_url)').order('created_at', { ascending: false }),
          supabase.from('posts').select('id, user_id, idea_id'),
          supabase.from('idea_members').select('id, idea_id, user_id'),
          supabase.from('post_attachments').select('file_size, file_type')
        ]);

        const users = profilesRes.data || [];
        const ideas = ideasRes.data || [];
        const posts = postsRes.data || [];
        const attachments = attachmentsRes.data || [];
        const members = membersRes.data || [];

        const totalBytes = attachments.reduce((acc, a) => acc + Number(a.file_size || 0), 0);
        const imagesBytes = attachments.filter(a => a.file_type === 'image').reduce((acc, a) => acc + Number(a.file_size || 0), 0);
        const audioBytes = attachments.filter(a => a.file_type === 'audio').reduce((acc, a) => acc + Number(a.file_size || 0), 0);
        const docBytes = attachments.filter(a => !['image', 'audio'].includes(a.file_type)).reduce((acc, a) => acc + Number(a.file_size || 0), 0);
        const limitBytes = 1073741824; // 1GB

        const enrichedUsers = users.map(u => ({
          ...u,
          ideas_count: ideas.filter(i => i.owner_id === u.id).length,
          posts_count: posts.filter(p => p.user_id === u.id).length
        }));

        const enrichedIdeas = ideas.map(i => ({
          ...i,
          owner_name: i.owner?.display_name || 'Unknown',
          owner_email: i.owner?.email || 'unknown@example.com',
          owner_avatar: i.owner?.avatar_url || '',
          posts_count: posts.filter(p => p.idea_id === i.id).length,
          members_count: members.filter(m => m.idea_id === i.id).length + 1
        }));

        return {
          users_count: users.length,
          ideas_count: ideas.length,
          posts_count: posts.length,
          members_count: members.length,
          attachments_count: attachments.length,
          total_storage_bytes: totalBytes,
          storage_limit_bytes: limitBytes,
          percentage_used: Math.min(100, (totalBytes / limitBytes) * 100),
          storage_mb_used: (totalBytes / (1024 * 1024)).toFixed(2),
          storage_mb_limit: '1024',
          storage_remaining_mb: (Math.max(0, limitBytes - totalBytes) / (1024 * 1024)).toFixed(2),
          images_mb: (imagesBytes / (1024 * 1024)).toFixed(2),
          audio_mb: (audioBytes / (1024 * 1024)).toFixed(2),
          doc_mb: (docBytes / (1024 * 1024)).toFixed(2),
          users: enrichedUsers,
          ideas: enrichedIdeas,
          tables: [
            { name: 'profiles', count: users.length, description: 'User accounts & profiles' },
            { name: 'ideas', count: ideas.length, description: 'Idea workspaces & themes' },
            { name: 'idea_members', count: members.length, description: 'Idea member collaboration & roles' },
            { name: 'posts', count: posts.length, description: 'Discussions, messages & notes' },
            { name: 'post_attachments', count: attachments.length, description: 'Images, audio recordings, files' }
          ]
        };
      } catch (e) {
        console.error('Admin stats fallback failed:', e);
      }
    }

    // LocalStore mock fallback
    const users = localStore.getUsers();
    const ideas = localStore.getIdeas();
    return {
      users_count: users.length,
      ideas_count: ideas.length,
      posts_count: 12,
      members_count: 4,
      attachments_count: 8,
      total_storage_bytes: 15728640,
      storage_limit_bytes: 1073741824,
      percentage_used: 1.46,
      storage_mb_used: '15.00',
      storage_mb_limit: '1024',
      storage_remaining_mb: '1009.00',
      images_mb: '12.40',
      audio_mb: '2.10',
      doc_mb: '0.50',
      users: users.map(u => ({ ...u, ideas_count: 1, posts_count: 2 })),
      ideas: ideas.map(i => ({
        ...i,
        owner_name: 'Idea Creator',
        owner_email: 'creator@example.com',
        posts_count: 3,
        members_count: 2
      })),
      tables: [
        { name: 'profiles', count: users.length, description: 'User accounts & profiles' },
        { name: 'ideas', count: ideas.length, description: 'Idea workspaces & themes' }
      ]
    };
  },

  // Delete user by ID (cascades and deletes auth + profile + data)
  async deleteUser(userId) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }
      return data;
    }
    return { success: true };
  },

  // Get raw table rows for the Data Tables viewer & editor
  async getTableRows(tableName, limit = 50) {
    if (isSupabaseConfigured) {
      const validTables = ['profiles', 'ideas', 'idea_members', 'posts', 'post_attachments', 'notifications'];
      if (!validTables.includes(tableName)) {
        throw new Error('Invalid table selected');
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(limit);

      if (error) throw error;
      return data || [];
    }
    return [];
  },

  // Delete a specific row from a table
  async deleteTableRow(tableName, rowId) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', rowId);

      if (error) throw error;
      return true;
    }
    return true;
  },

  // Update a row in a table (e.g. edit idea, profile)
  async updateTableRow(tableName, rowId, updates) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', rowId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
    return updates;
  }
};
