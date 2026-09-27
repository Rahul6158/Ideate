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
            const isMember = item.idea_members?.some(m => m.user_id === currentUserId);
            return {
              ...item,
              is_shared: !isOwner && isMember,
              members_count: (item.idea_members?.length || 0) + 1,
              posts_count: item.posts?.length || 0
            };
          }).filter(idea => {
            if (filter === 'my') return idea.owner_id === currentUserId;
            if (filter === 'shared') return idea.is_shared;
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
            idea_members(user_id, role, profiles(*)),
            posts(id)
          `)
          .eq('id', id)
          .single();
        if (!error && data) {
          return {
            ...data,
            is_shared: data.owner_id !== currentUserId,
            members_count: (data.idea_members?.length || 0) + 1,
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
        if (!error && data) return data;
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
      members_count: 1,
      posts_count: 0,
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
    localStore.setPosts(newIdea.id, []);

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
