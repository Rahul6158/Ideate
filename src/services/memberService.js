import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { getRandomAvatar } from '../data/avatars';

export const memberService = {
  async getMembers(ideaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('idea_members')
          .select(`
            id,
            role,
            created_at,
            profiles:user_id(id, email, display_name, avatar_url, role)
          `)
          .eq('idea_id', ideaId);
        if (!error && data) {
          return data.map(m => ({
            id: m.id,
            role: m.role || 'Member',
            user_id: m.profiles?.id,
            email: m.profiles?.email,
            display_name: m.profiles?.display_name,
            avatar_url: m.profiles?.avatar_url
          }));
        }
      } catch (err) {
        console.warn('Supabase getMembers error:', err.message);
      }
    }

    return localStore.getMembers(ideaId);
  },

  // Instant DB search for registered users by email or display name
  async searchUsers(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url, role')
          .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
          .limit(8);

        if (!error && data) {
          return data.map(u => ({
            ...u,
            avatar_url: u.avatar_url || getRandomAvatar(u.email || u.display_name)
          }));
        }
      } catch (err) {
        console.warn('searchUsers Supabase error:', err.message);
      }
    }

    // Local fallback
    const allUsers = localStore.getUsers();
    return allUsers.filter(u => 
      u.email?.toLowerCase().includes(q) || 
      u.display_name?.toLowerCase().includes(q)
    );
  },

  async addMember(ideaId, target, role = 'Member') {
    let profile = null;

    if (isSupabaseConfigured) {
      // 1. Resolve profile
      if (typeof target === 'object' && target?.id) {
        profile = target;
      } else if (typeof target === 'string') {
        const isEmail = target.includes('@');
        let query = supabase.from('profiles').select('id, email, display_name, avatar_url, role');
        if (isEmail) {
          query = query.eq('email', target.trim().toLowerCase());
        } else {
          query = query.eq('id', target.trim());
        }
        const { data, error: findError } = await query.single();
        if (findError || !data) {
          throw new Error('No registered account found with this email. Ask them to sign up first.');
        }
        profile = data;
      }

      if (!profile?.id) {
        throw new Error('Invalid member account selected.');
      }

      // 2. Insert into idea_members
      const { data, error } = await supabase
        .from('idea_members')
        .insert({
          idea_id: ideaId,
          user_id: profile.id,
          role: role.toLowerCase()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This user is already a collaborator on this idea.');
        }
        throw error;
      }

      // 3. Update idea members_count
      try {
        const { count } = await supabase
          .from('idea_members')
          .select('id', { count: 'exact', head: true })
          .eq('idea_id', ideaId);
        
        await supabase
          .from('ideas')
          .update({
            members_count: (count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', ideaId);
      } catch (e) {
        // non-critical
      }

      // 4. Send notification to the added user
      try {
        const { data: ideaData } = await supabase
          .from('ideas')
          .select('title')
          .eq('id', ideaId)
          .single();

        await supabase.from('notifications').insert({
          user_id: profile.id,
          idea_id: ideaId,
          title: 'Added to Idea Space 🎉',
          message: `You have been added as a collaborator to "${ideaData?.title || 'an idea'}".`,
          type: 'member'
        });
      } catch (e) {
        // non-critical
      }

      return {
        id: data.id,
        role,
        user_id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url || getRandomAvatar(profile.email)
      };
    }

    // Offline cache / Local fallback
    const members = localStore.getMembers(ideaId);
    const targetEmail = typeof target === 'string' ? target.trim().toLowerCase() : target?.email?.toLowerCase();
    const existing = members.find(m => m.email?.toLowerCase() === targetEmail);
    if (existing) {
      throw new Error('This user is already a collaborator on this idea.');
    }

    const allUsers = localStore.getUsers();
    let foundUser = typeof target === 'object' && target?.id ? target : allUsers.find(u => u.email?.toLowerCase() === targetEmail);
    
    if (!foundUser) {
      throw new Error('No registered account found with this email. Ask them to sign up first.');
    }

    const newMember = {
      id: 'm-' + Date.now(),
      user_id: foundUser.id,
      idea_id: ideaId,
      role: role || 'Member',
      display_name: foundUser.display_name,
      email: foundUser.email,
      avatar_url: foundUser.avatar_url || getRandomAvatar(foundUser.email)
    };

    members.push(newMember);
    localStore.setMembers(ideaId, members);

    // Update members_count on idea in localStore
    const ideas = localStore.getIdeas();
    const ideaIdx = ideas.findIndex(i => i.id === ideaId);
    if (ideaIdx !== -1) {
      ideas[ideaIdx].members_count = members.length + 1;
      localStore.setIdeas(ideas);
    }

    return newMember;
  },

  async removeMember(ideaId, memberId) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('idea_members')
        .delete()
        .match({ idea_id: ideaId, id: memberId });
      if (error) {
        // Try user_id match
        await supabase
          .from('idea_members')
          .delete()
          .match({ idea_id: ideaId, user_id: memberId });
      }

      // Update idea members count
      try {
        const { count } = await supabase
          .from('idea_members')
          .select('id', { count: 'exact', head: true })
          .eq('idea_id', ideaId);
        
        await supabase
          .from('ideas')
          .update({
            members_count: (count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', ideaId);
      } catch (e) {}

      return true;
    }

    let members = localStore.getMembers(ideaId);
    members = members.filter(m => m.id !== memberId && m.user_id !== memberId);
    localStore.setMembers(ideaId, members);

    const ideas = localStore.getIdeas();
    const ideaIdx = ideas.findIndex(i => i.id === ideaId);
    if (ideaIdx !== -1) {
      ideas[ideaIdx].members_count = Math.max(1, members.length + 1);
      localStore.setIdeas(ideas);
    }

    return true;
  }
};
