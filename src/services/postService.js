import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';

export const postService = {
  async getPosts(ideaId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            idea_id,
            user_id,
            content,
            reply_to,
            is_system,
            created_at,
            user:profiles!posts_user_id_fkey(id, email, display_name, avatar_url),
            attachments:post_attachments(*),
            reactions:post_reactions(*, user:profiles!post_reactions_user_id_fkey(id, email, display_name, avatar_url))
          `)
          .eq('idea_id', ideaId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(p => ({
            ...p,
            timestamp: new Date(p.created_at).getTime(),
            created_at: formatTimestamp(p.created_at),
            reactions: p.reactions || []
          }));
        }
      } catch (err) {
        console.warn('Supabase getPosts error:', err.message);
      }
    }

    return localStore.getPosts(ideaId);
  },

  async createPost(ideaId, { content, attachments = [], reply_to = null }, currentUser) {
    const formattedTime = formatTimestamp(new Date());

    if (isSupabaseConfigured) {
      try {
        // Insert post
        const { data: post, error: postError } = await supabase
          .from('posts')
          .insert({
            idea_id: ideaId,
            user_id: currentUser.id,
            content: content || null,
            reply_to: reply_to || null,
            is_system: false
          })
          .select()
          .single();

        if (postError) {
          console.warn('Supabase posts table insert error, falling back to localStore:', postError.message);
        } else if (post) {
          // Insert attachments if any
          let createdAttachments = [];
          if (attachments.length > 0) {
            const attachmentInserts = attachments.map(att => ({
              post_id: post.id,
              file_name: att.file_name,
              file_type: att.file_type,
              file_size: att.file_size || 0,
              storage_path: att.storage_path,
              duration_seconds: att.duration_seconds || null
            }));

            const { data: attData, error: attError } = await supabase
              .from('post_attachments')
              .insert(attachmentInserts)
              .select();

            if (attError) {
              console.warn('Supabase post_attachments insert error:', attError.message);
              createdAttachments = attachments;
            } else {
              createdAttachments = attData || attachments;
            }
          }

          // Update idea timestamp
          try {
            await supabase
              .from('ideas')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', ideaId);
          } catch (e) {
            // Ignore idea update error
          }

          return {
            ...post,
            created_at: formattedTime,
            user: {
              id: currentUser.id,
              display_name: currentUser.display_name,
              email: currentUser.email,
              avatar_url: currentUser.avatar_url
            },
            attachments: createdAttachments,
            reactions: []
          };
        }
      } catch (err) {
        console.warn('Supabase createPost error (falling back to local storage):', err.message);
      }
    }

    // Offline cache / Local store fallback
    const posts = localStore.getPosts(ideaId);
    const newPost = {
      id: 'post-' + Date.now(),
      idea_id: ideaId,
      user_id: currentUser.id,
      user: {
        id: currentUser.id,
        display_name: currentUser.display_name,
        email: currentUser.email,
        avatar_url: currentUser.avatar_url
      },
      content: content || '',
      reply_to: reply_to || null,
      is_system: false,
      created_at: formattedTime,
      timestamp: Date.now(),
      reactions: [],
      attachments: attachments.map((att, i) => ({
        id: 'att-' + Date.now() + '-' + i,
        ...att
      }))
    };

    posts.push(newPost);
    localStore.setPosts(ideaId, posts);

    return newPost;
  },

  async deletePost(ideaId, postId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (!error) return true;
        console.warn('Supabase deletePost error:', error.message);
      } catch (err) {
        console.warn('Supabase deletePost error:', err.message);
      }
    }

    let posts = localStore.getPosts(ideaId);
    posts = posts.filter(p => p.id !== postId);
    localStore.setPosts(ideaId, posts);
    return true;
  },

  /**
   * Clear all messages of a user from an idea with reason note
   */
  async clearUserPosts(ideaId, userId, reason) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('clear_user_idea_posts', {
          target_idea_id: ideaId,
          target_user_id: userId,
          clear_reason: reason || 'No reason provided'
        });
        if (!error) return true;
        console.warn('RPC clear_user_idea_posts error:', error.message);
      } catch (err) {
        console.warn('clearUserPosts error:', err.message);
      }
    }

    // LocalStore fallback
    let posts = localStore.getPosts(ideaId);
    posts = posts.filter(p => p.user_id !== userId);
    posts.push({
      id: 'system-' + Date.now(),
      idea_id: ideaId,
      user_id: userId,
      content: `A member cleared all their messages. Reason: "${reason || 'No reason provided'}"`,
      is_system: true,
      created_at: formatTimestamp(new Date()),
      timestamp: Date.now(),
      attachments: [],
      reactions: []
    });
    localStore.setPosts(ideaId, posts);
    return true;
  },

  /**
   * Toggle emoji reaction for a post
   */
  async toggleReaction(postId, userId, emoji) {
    let result = { action: 'toggled', emoji };

    if (isSupabaseConfigured && userId) {
      try {
        // Check if existing
        const { data: existing } = await supabase
          .from('post_reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .eq('emoji', emoji)
          .maybeSingle();

        if (existing) {
          await supabase.from('post_reactions').delete().eq('id', existing.id);
          result = { action: 'removed', emoji, id: existing.id };
        } else {
          const { data: inserted, error: insErr } = await supabase.from('post_reactions').insert({
            post_id: postId,
            user_id: userId,
            emoji
          }).select().single();
          if (insErr) {
            console.warn('post_reactions insert notice:', insErr.message);
          }
          result = { action: 'added', emoji, data: inserted };
        }
      } catch (err) {
        console.warn('toggleReaction error:', err.message);
      }
    }

    // Also update localStore cache so local and offline stays in sync
    try {
      const posts = localStore.getPosts() || [];
      const post = posts.find(p => p.id === postId);
      if (post) {
        if (!post.reactions) post.reactions = [];
        const exIdx = post.reactions.findIndex(r => r.user_id === userId && r.emoji === emoji);
        if (exIdx !== -1) {
          post.reactions.splice(exIdx, 1);
        } else {
          post.reactions.push({ post_id: postId, user_id: userId, emoji });
        }
        localStore.savePosts(posts);
      }
    } catch (_) {}

    return result;
  },

  subscribeToPosts(ideaId, onNewPost, onDeletePost, onReactionChange) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel(`idea-posts-${ideaId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: `idea_id=eq.${ideaId}`
      }, async (payload) => {
        // Fetch full post with user profile
        const { data } = await supabase
          .from('posts')
          .select(`
            id,
            idea_id,
            user_id,
            content,
            reply_to,
            is_system,
            created_at,
            user:profiles!posts_user_id_fkey(id, email, display_name, avatar_url),
            attachments:post_attachments(*),
            reactions:post_reactions(*, user:profiles!post_reactions_user_id_fkey(id, email, display_name, avatar_url))
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onNewPost({
            ...data,
            timestamp: new Date(data.created_at).getTime(),
            created_at: formatTimestamp(data.created_at),
            reactions: data.reactions || []
          });
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'posts',
        filter: `idea_id=eq.${ideaId}`
      }, (payload) => {
        if (onDeletePost && payload.old) {
          onDeletePost(payload.old.id);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_reactions'
      }, async (payload) => {
        if (onReactionChange) {
          onReactionChange(payload);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

function formatTimestamp(dateInput) {
  const d = new Date(dateInput);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}
