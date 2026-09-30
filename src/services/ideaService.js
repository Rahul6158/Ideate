import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { COVER_IMAGES } from '../data/mockData';

export const ideaService = {
  async getIdeas(filter = 'all', currentUserId) {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('ideas')
          .select(`
            *,
            owner:profiles!ideas_owner_id_fkey(id, email, display_name, avatar_url),
            idea_members(user_id, role),
            posts(id)
          `)
          .order('updated_at', { ascending: false });

        const { data, error } = await query;
        if (!error && data) {
          return data.map(item => {
            const isOwner = item.owner_id === currentUserId;
            const isMember = item.idea_members?.some(m => 
              m.user_id === currentUserId && m.role !== 'pending_invite' && m.role !== 'pending_join'
            );
            const hasPendingInvite = item.idea_members?.some(m => 
              m.user_id === currentUserId && m.role === 'pending_invite'
            );
            const hasPendingJoin = item.idea_members?.some(m => 
              m.user_id === currentUserId && m.role === 'pending_join'
            );
            const activeMembers = (item.idea_members || []).filter(m => 
              m.role !== 'pending_invite' && m.role !== 'pending_join'
            );

            return {
              ...item,
              is_shared: !isOwner && isMember,
              is_pending_invite: hasPendingInvite,
              is_pending_join: hasPendingJoin,
              members_count: activeMembers.length + 1,
              posts_count: item.posts?.length || 0
            };
          }).filter(idea => {
            if (filter === 'my') return idea.owner_id === currentUserId;
            if (filter === 'shared') return idea.is_shared;
            if (filter === 'invites') return idea.is_pending_invite;
            return true;
          });
        }
      } catch (err) {
        console.warn('Supabase ideas table not ready yet, using local store:', err.message);
      }
    }

    // Offline cache / Local fallback
    const allIdeas = localStore.getIdeas();
    const currentUser = currentUserId || localStore.getCurrentUser()?.id;

    return allIdeas.filter(idea => {
      const isOwner = idea.owner_id === currentUser;
      const isShared = idea.is_shared || (!isOwner);
      if (filter === 'my') return isOwner;
      if (filter === 'shared') return isShared;
      return true;
    });
  },

  async getIdeaById(id, currentUserId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ideas')
          .select(`
            *,
            owner:profiles!ideas_owner_id_fkey(id, email, display_name, avatar_url),
            idea_members(id, user_id, role, created_at, profiles(*)),
            posts(id)
          `)
          .eq('id', id)
          .single();
        if (!error && data) {
          const isOwner = data.owner_id === currentUserId;
          const isMember = data.idea_members?.some(m => 
            m.user_id === currentUserId && m.role !== 'pending_invite' && m.role !== 'pending_join'
          );
          const activeMembers = (data.idea_members || []).filter(m => 
            m.role !== 'pending_invite' && m.role !== 'pending_join'
          );
          return {
            ...data,
            is_shared: !isOwner && isMember,
            members_count: activeMembers.length + 1,
            posts_count: data.posts?.length || 0
          };
        }
      } catch (err) {
        console.warn('Supabase getIdeaById error:', err.message);
      }
    }

    const ideas = localStore.getIdeas();
    return ideas.find(i => i.id === id) || null;
  },

  async createIdea({ title, description, cover_url, color_theme = 'blue' }, currentUser) {
    const covers = [
      COVER_IMAGES.resume,
      COVER_IMAGES.voice,
      COVER_IMAGES.pharma,
      COVER_IMAGES.travel,
      COVER_IMAGES.college,
      COVER_IMAGES.startup,
      COVER_IMAGES.ai_brain,
      COVER_IMAGES.cyber_code,
      COVER_IMAGES.crypto_fintech,
      COVER_IMAGES.design_studio,
      COVER_IMAGES.green_eco,
      COVER_IMAGES.gaming_space
    ];
    const chosenCover = cover_url || covers[Math.floor(Math.random() * covers.length)];
    const chosenColor = color_theme || 'blue';

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ideas')
          .insert({
            title,
            description,
            cover_url: chosenCover,
            color_theme: chosenColor,
            owner_id: currentUser.id
          })
          .select()
          .single();

        if (!error && data) {
          // Phase 2: Automatically add Idvy welcome message & default AI access to every new idea
          try {
            // 1. Initialize owner AI access
            await supabase.from('idea_ai_access').insert({
              idea_id: data.id,
              user_id: currentUser.id,
              can_use_ai: true,
              is_ai_enabled: true
            });

            // 2. Post Idvy's personalized friendly welcome greeting into the discussion
            const creatorName = currentUser?.display_name || currentUser?.email?.split('@')[0] || 'friend';
            const welcomeGreeting = `Hey @${creatorName}! 👋 I'm **Idvy**, your collaborative partner and idea friend! 🎉\n\nEven if it's just the two of us right now, don't worry—we've got this. I'm ready to dive into **"${title}"** with you!\n\nWhenever you want to bounce thoughts around, here are some things we can do together:\n- 💡 Brainstorm & sharpen the vision: type \`/coreidea\` or \`/improve\`\n- 🎯 Pressure-test ideas & spot blind spots: type \`/validate\`\n- 📋 Keep everything neat & organized: type \`/summarize\`, \`/decisions\`, or \`/actionitems\`\n- 🌐 Search trends & live web insights: type \`/websearch\` or \`/research\`\n\nOr just tag me anytime: **@Idvy**. Let's build something incredible together! ✨`;

            await supabase.from('posts').insert({
              idea_id: data.id,
              user_id: currentUser.id,
              content: welcomeGreeting,
              sender_type: 'ai',
              agent_name: 'idvy',
              is_system: false
            });
          } catch (aiInitErr) {
            console.warn('Idvy auto-welcome setup notice:', aiInitErr.message);
          }

          return data;
        }
      } catch (err) {
        console.warn('Supabase createIdea notice:', err.message);
      }
    }

    const ideas = localStore.getIdeas();
    const newIdea = {
      id: 'idea-' + Date.now(),
      title,
      description: description || '',
      owner_id: currentUser.id,
      cover_url: chosenCover,
      color_theme: chosenColor,
      members_count: 2, // Owner + Idvy
      posts_count: 1, // Welcome post
      updated_at: 'Just now',
      updated_timestamp: Date.now(),
      created_at: new Date().toISOString(),
      is_shared: false
    };

    ideas.unshift(newIdea);
    localStore.setIdeas(ideas);

    // Set initial owner member
    const initialMember = {
      id: 'm-' + Date.now(),
      user_id: currentUser.id,
      idea_id: newIdea.id,
      role: 'Owner',
      display_name: currentUser.display_name,
      email: currentUser.email,
      avatar_url: currentUser.avatar_url
    };
    localStore.setMembers(newIdea.id, [initialMember]);

    // Set initial Idvy welcome post in localStore
    const welcomePost = {
      id: 'post-idvy-welcome-' + Date.now(),
      idea_id: newIdea.id,
      user_id: '00000000-0000-0000-0000-000000001d71',
      sender_type: 'ai',
      agent_name: 'idvy',
      user: {
        id: '00000000-0000-0000-0000-000000001d71',
        display_name: 'Idvy',
        email: 'idvy@ideate.app',
        avatar_url: '/avatars/idvy-avatar.avif'
      },
      content: `Hey @${currentUser?.display_name || 'friend'}! 👋 I'm **Idvy**, your collaborative partner and idea friend! 🎉\n\nEven if it's just the two of us right now, don't worry—we've got this. I'm ready to dive into **"${title}"** with you!\n\nWhenever you want to bounce thoughts around, here are some things we can do together:\n- 💡 Brainstorm & sharpen the vision: type \`/coreidea\` or \`/improve\`\n- 🎯 Pressure-test ideas & spot blind spots: type \`/validate\`\n- 📋 Keep everything neat & organized: type \`/summarize\`, \`/decisions\`, or \`/actionitems\`\n- 🌐 Search trends & live web insights: type \`/websearch\` or \`/research\`\n\nOr just tag me anytime: **@Idvy**. Let's build something incredible together! ✨`,
      reply_to: null,
      is_system: false,
      created_at: 'Just now',
      timestamp: Date.now(),
      reactions: [],
      attachments: []
    };
    localStore.setPosts(newIdea.id, [welcomePost]);

    return newIdea;
  },

  async updateIdea(id, { title, description, cover_url, color_theme }) {
    if (isSupabaseConfigured) {
      try {
        const updatePayload = {
          updated_at: new Date().toISOString()
        };
        if (title !== undefined) updatePayload.title = title;
        if (description !== undefined) updatePayload.description = description;
        if (cover_url !== undefined) updatePayload.cover_url = cover_url;
        if (color_theme !== undefined) updatePayload.color_theme = color_theme;

        const { data, error } = await supabase
          .from('ideas')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase updateIdea notice:', err.message);
      }
    }

    const ideas = localStore.getIdeas();
    const idx = ideas.findIndex(i => i.id === id);
    if (idx !== -1) {
      ideas[idx] = {
        ...ideas[idx],
        title: title !== undefined ? title : ideas[idx].title,
        description: description !== undefined ? description : ideas[idx].description,
        cover_url: cover_url !== undefined ? cover_url : ideas[idx].cover_url,
        color_theme: color_theme !== undefined ? color_theme : (ideas[idx].color_theme || 'blue'),
        updated_at: 'Just now',
        updated_timestamp: Date.now()
      };
      localStore.setIdeas(ideas);
      return ideas[idx];
    }
    return null;
  },

  async deleteIdea(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('ideas').delete().eq('id', id);
      if (error) throw error;
      return true;
    }

    let ideas = localStore.getIdeas();
    ideas = ideas.filter(i => i.id !== id);
    localStore.setIdeas(ideas);
    return true;
  }
};
