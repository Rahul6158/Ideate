import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { getRandomAvatar } from '../data/avatars';

export const memberService = {
  async getMembers(ideaId) {
    const idvyBotMember = {
      id: '00000000-0000-0000-0000-000000001d71',
      user_id: '00000000-0000-0000-0000-000000001d71',
      role: 'AI Collaborator & Friend',
      display_name: 'Idvy',
      email: 'idvy@ideate.app',
      avatar_url: '/avatars/idvy-avatar.avif',
      is_ai: true
    };

    let list = [];
    if (isSupabaseConfigured) {
      try {
        const [membersRes, ideaRes] = await Promise.all([
          supabase
            .from('idea_members')
            .select(`
              id,
              role,
              created_at,
              profiles:user_id(id, email, display_name, avatar_url, role)
            `)
            .eq('idea_id', ideaId),
          supabase
            .from('ideas')
            .select(`
              owner_id,
              owner:profiles!ideas_owner_id_fkey(id, email, display_name, avatar_url)
            `)
            .eq('id', ideaId)
            .maybeSingle()
        ]);

        if (!membersRes.error && membersRes.data) {
          list = membersRes.data.map(m => ({
            id: m.id,
            role: m.role || 'Member',
            user_id: m.profiles?.id,
            email: m.profiles?.email,
            display_name: m.profiles?.display_name,
            avatar_url: m.profiles?.avatar_url
          }));
        }

        // Add owner if not already in list
        const owner = ideaRes.data?.owner;
        if (owner?.id && !list.some(m => m.user_id === owner.id)) {
          list.unshift({
            id: 'owner-' + owner.id,
            role: 'Owner',
            user_id: owner.id,
            email: owner.email,
            display_name: owner.display_name,
            avatar_url: owner.avatar_url
          });
        }
      } catch (err) {
        console.warn('Supabase getMembers error:', err.message);
      }
    } else {
      list = localStore.getMembers(ideaId) || [];
    }

    // Always ensure Idvy is present as an active collaborator and friend
    if (!list.some(m => m.user_id === idvyBotMember.user_id || m.id === idvyBotMember.id)) {
      list.push(idvyBotMember);
    }

    return list;
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
    return this.inviteMember(ideaId, target, role);
  },

  async inviteMember(ideaId, target, role = 'Member') {
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

      // Check existing membership
      const { data: existing } = await supabase
        .from('idea_members')
        .select('id, role')
        .match({ idea_id: ideaId, user_id: profile.id })
        .maybeSingle();

      if (existing) {
        if (existing.role === 'pending_invite') {
          throw new Error('An invitation has already been sent to this user.');
        }
        throw new Error('This user is already a collaborator on this idea.');
      }

      // 2. Insert into idea_members with role 'pending_invite'
      const { data, error } = await supabase
        .from('idea_members')
        .insert({
          idea_id: ideaId,
          user_id: profile.id,
          role: 'pending_invite'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This user already has an invitation or is a member of this idea.');
        }
        throw error;
      }

      // 3. Send notification to the invited user
      try {
        const { data: ideaData } = await supabase
          .from('ideas')
          .select('title')
          .eq('id', ideaId)
          .single();

        await supabase.from('notifications').insert({
          user_id: profile.id,
          idea_id: ideaId,
          title: 'Invitation to Join Idea Space 🤝',
          message: `You have been invited to collaborate on "${ideaData?.title || 'an idea'}". Would you like to join?`,
          type: 'invite'
        });
      } catch (e) {
        console.warn('Invite notification error:', e);
      }

      return {
        id: data.id,
        role: 'pending_invite',
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
      if (existing.role === 'pending_invite') {
        throw new Error('An invitation has already been sent to this user.');
      }
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
      role: 'pending_invite',
      display_name: foundUser.display_name,
      email: foundUser.email,
      avatar_url: foundUser.avatar_url || getRandomAvatar(foundUser.email)
    };

    members.push(newMember);
    localStore.setMembers(ideaId, members);

    return newMember;
  },

  async acceptInvite(ideaId, userId) {
    if (isSupabaseConfigured) {
      // 1. Try updating role to 'member' and return updated rows
      const { data: updatedRows, error: updateError } = await supabase
        .from('idea_members')
        .update({ role: 'member' })
        .match({ idea_id: ideaId, user_id: userId })
        .select('id, role');

      // 2. If RLS blocked UPDATE (0 rows affected) or update failed, use delete + insert
      if (updateError || !updatedRows || updatedRows.length === 0) {
        const { error: delErr } = await supabase
          .from('idea_members')
          .delete()
          .match({ idea_id: ideaId, user_id: userId });

        if (delErr) throw delErr;

        const { error: insErr } = await supabase
          .from('idea_members')
          .insert({
            idea_id: ideaId,
            user_id: userId,
            role: 'member'
          });

        if (insErr && insErr.code !== '23505') {
          throw insErr;
        }
      }

      // 3. Run secondary updates (members_count, owner notification, cleanup invite notification) in background for instant mobile response
      (async () => {
        try {
          const [countRes, ideaRes, profileRes] = await Promise.allSettled([
            supabase
              .from('idea_members')
              .select('id', { count: 'exact', head: true })
              .eq('idea_id', ideaId)
              .neq('role', 'pending_invite')
              .neq('role', 'pending_join'),
            supabase
              .from('ideas')
              .select('title, owner_id')
              .eq('id', ideaId)
              .single(),
            supabase
              .from('profiles')
              .select('display_name, email')
              .eq('id', userId)
              .single(),
            // Mark any pending invite notifications for this idea as read & accepted
            supabase
              .from('notifications')
              .update({
                is_read: true,
                type: 'member',
                title: 'Invitation Accepted ✅',
                viewed_at: new Date().toISOString()
              })
              .match({ user_id: userId, idea_id: ideaId, type: 'invite' })
          ]);

          const count = countRes.status === 'fulfilled' ? (countRes.value.count || 0) : 1;
          const ideaData = ideaRes.status === 'fulfilled' ? ideaRes.value.data : null;
          const userProfile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;

          await Promise.allSettled([
            supabase
              .from('ideas')
              .update({
                members_count: count + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', ideaId),
            ideaData?.owner_id
              ? supabase.from('notifications').insert({
                  user_id: ideaData.owner_id,
                  idea_id: ideaId,
                  title: 'Invitation Accepted 🎉',
                  message: `${userProfile?.display_name || userProfile?.email || 'A collaborator'} accepted your invitation to "${ideaData.title || 'Idea'}".`,
                  type: 'member'
                })
              : Promise.resolve()
          ]);
        } catch (e) {
          console.warn('Accept invite background update notice:', e);
        }
      })();

      return true;
    }

    // Local fallback
    const members = localStore.getMembers(ideaId);
    const idx = members.findIndex(m => m.user_id === userId);
    if (idx !== -1) {
      members[idx].role = 'member';
      localStore.setMembers(ideaId, members);

      const ideas = localStore.getIdeas();
      const ideaIdx = ideas.findIndex(i => i.id === ideaId);
      if (ideaIdx !== -1) {
        ideas[ideaIdx].members_count = members.filter(m => m.role !== 'pending_invite').length + 1;
        localStore.setIdeas(ideas);
      }
    }
    return true;
  },

  async rejectInvite(ideaId, userId) {
    if (isSupabaseConfigured) {
      // Remove pending invite row immediately
      const { error } = await supabase
        .from('idea_members')
        .delete()
        .match({ idea_id: ideaId, user_id: userId });

      if (error) throw error;

      // Run notification cleanup and owner notice in background
      (async () => {
        try {
          const [ideaRes, profileRes] = await Promise.allSettled([
            supabase.from('ideas').select('title, owner_id').eq('id', ideaId).single(),
            supabase.from('profiles').select('display_name, email').eq('id', userId).single(),
            supabase
              .from('notifications')
              .delete()
              .match({ user_id: userId, idea_id: ideaId, type: 'invite' })
          ]);

          const ideaData = ideaRes.status === 'fulfilled' ? ideaRes.value.data : null;
          const userProfile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
          const name = userProfile?.display_name || userProfile?.email || 'A user';

          if (ideaData?.owner_id) {
            await supabase.from('notifications').insert({
              user_id: ideaData.owner_id,
              idea_id: ideaId,
              title: 'Invitation Declined',
              message: `${name} declined the invitation to "${ideaData.title || 'Idea'}".`,
              type: 'system'
            });
          }
        } catch (_) {}
      })();

      return true;
    }

    // Local fallback
    let members = localStore.getMembers(ideaId);
    members = members.filter(m => m.user_id !== userId);
    localStore.setMembers(ideaId, members);
    return true;
  },

  async requestToJoin(ideaId, currentUser) {
    const cleanId = ideaId.trim();

    if (isSupabaseConfigured) {
      // 1. Fetch idea
      const { data: idea, error: ideaErr } = await supabase
        .from('ideas')
        .select('id, title, owner_id, description, color_theme, cover_url')
        .eq('id', cleanId)
        .single();

      if (ideaErr || !idea) {
        throw new Error('Idea not found. Please check the Idea ID and try again.');
      }

      if (idea.owner_id === currentUser.id) {
        throw new Error('You are the author of this idea space.');
      }

      // 2. Check if already member
      const { data: existingMember } = await supabase
        .from('idea_members')
        .select('role')
        .match({ idea_id: cleanId, user_id: currentUser.id })
        .maybeSingle();

      if (existingMember) {
        if (existingMember.role === 'member' || existingMember.role === 'admin') {
          throw new Error('You are already an active collaborator on this idea.');
        }
        if (existingMember.role === 'pending_invite') {
          throw new Error('You already have a pending invitation to this idea! Check your notifications to accept.');
        }
      }

      // 3. Send join request notification to idea owner
      const requesterName = currentUser.display_name || currentUser.email.split('@')[0];
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: idea.owner_id,
        idea_id: idea.id,
        title: 'New Join Request 📩',
        message: `${requesterName} (${currentUser.email}) requested to join "${idea.title}". [uid:${currentUser.id}]`,
        type: 'join_request'
      });

      if (notifErr) {
        console.warn('Could not post join request notification:', notifErr.message);
      }

      return {
        success: true,
        idea
      };
    }

    // Local fallback
    const ideas = localStore.getIdeas();
    const idea = ideas.find(i => i.id === cleanId);
    if (!idea) {
      throw new Error('Idea not found. Please check the Idea ID and try again.');
    }
    if (idea.owner_id === currentUser.id) {
      throw new Error('You are the author of this idea space.');
    }

    const members = localStore.getMembers(cleanId);
    const existing = members.find(m => m.user_id === currentUser.id);
    if (existing && existing.role !== 'pending_invite') {
      throw new Error('You are already an active collaborator on this idea.');
    }

    return { success: true, idea };
  },

  async acceptJoinRequest(ideaId, requesterUserId, notificationId = null) {
    if (isSupabaseConfigured) {
      // 1. Insert into idea_members as 'member'
      const { data: existing } = await supabase
        .from('idea_members')
        .select('id')
        .match({ idea_id: ideaId, user_id: requesterUserId })
        .maybeSingle();

      if (existing) {
        const { data: updatedRows, error: updErr } = await supabase
          .from('idea_members')
          .update({ role: 'member' })
          .match({ idea_id: ideaId, user_id: requesterUserId })
          .select('id');

        if (updErr || !updatedRows || updatedRows.length === 0) {
          await supabase
            .from('idea_members')
            .delete()
            .match({ idea_id: ideaId, user_id: requesterUserId });

          await supabase
            .from('idea_members')
            .insert({
              idea_id: ideaId,
              user_id: requesterUserId,
              role: 'member'
            });
        }
      } else {
        await supabase
          .from('idea_members')
          .insert({
            idea_id: ideaId,
            user_id: requesterUserId,
            role: 'member'
          });
      }

      // 2. Update members count on idea
      const { count } = await supabase
        .from('idea_members')
        .select('id', { count: 'exact', head: true })
        .eq('idea_id', ideaId)
        .neq('role', 'pending_invite')
        .neq('role', 'pending_join');

      const { data: ideaData } = await supabase
        .from('ideas')
        .update({
          members_count: (count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', ideaId)
        .select('title')
        .single();

      // 3. Send notification to the requester
      await supabase.from('notifications').insert({
        user_id: requesterUserId,
        idea_id: ideaId,
        title: 'Join Request Approved 🎉',
        message: `Your request to join "${ideaData?.title || 'an idea'}" has been approved! You can now collaborate.`,
        type: 'member'
      });

      // 4. Mark notification as read if provided
      if (notificationId) {
        await supabase
          .from('notifications')
          .update({ is_read: true, viewed_at: new Date().toISOString() })
          .eq('id', notificationId);
      }

      return true;
    }

    // Local fallback
    const members = localStore.getMembers(ideaId);
    if (!members.some(m => m.user_id === requesterUserId)) {
      const allUsers = localStore.getUsers();
      const u = allUsers.find(x => x.id === requesterUserId) || { id: requesterUserId, display_name: 'Member', email: '' };
      members.push({
        id: 'm-' + Date.now(),
        idea_id: ideaId,
        user_id: requesterUserId,
        role: 'member',
        display_name: u.display_name,
        email: u.email
      });
      localStore.setMembers(ideaId, members);
    }
    return true;
  },

  async rejectJoinRequest(ideaId, requesterUserId, notificationId = null) {
    if (isSupabaseConfigured) {
      try {
        const { data: ideaData } = await supabase
          .from('ideas')
          .select('title')
          .eq('id', ideaId)
          .single();

        // Send decline notification to requester
        await supabase.from('notifications').insert({
          user_id: requesterUserId,
          idea_id: ideaId,
          title: 'Join Request Declined',
          message: `Your request to join "${ideaData?.title || 'an idea'}" was not accepted.`,
          type: 'system'
        });

        // Mark notification as read if provided
        if (notificationId) {
          await supabase
            .from('notifications')
            .update({ is_read: true, viewed_at: new Date().toISOString() })
            .eq('id', notificationId);
        }
      } catch (err) {
        console.warn('Reject join request notice:', err);
      }
      return true;
    }

    return true;
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
          .eq('idea_id', ideaId)
          .neq('role', 'pending_invite')
          .neq('role', 'pending_join');
        
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
