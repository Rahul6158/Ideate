import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { notificationService } from './notificationService';

// Metadata prefix & suffix for resilient schema-agnostic storage
const META_PREFIX = '<!--ideate-meta:';
const META_SUFFIX = '-->';

function encodePostContent(rawContent, { sender_type, agent_name, ai_metadata, reply_to, is_system }) {
  const meta = {};
  if (sender_type && sender_type !== 'user') meta.sender_type = sender_type;
  if (agent_name) meta.agent_name = agent_name;
  if (ai_metadata) meta.ai_metadata = ai_metadata;
  if (reply_to) meta.reply_to = reply_to;
  if (is_system) meta.is_system = is_system;

  if (Object.keys(meta).length === 0) return rawContent || '';
  return `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}\n${rawContent || ''}`;
}

function decodePostContent(storedContent) {
  if (!storedContent || typeof storedContent !== 'string') {
    return { content: storedContent || '', meta: {} };
  }
  if (storedContent.startsWith(META_PREFIX)) {
    const endIdx = storedContent.indexOf(META_SUFFIX);
    if (endIdx !== -1) {
      try {
        const jsonStr = storedContent.slice(META_PREFIX.length, endIdx);
        const meta = JSON.parse(jsonStr);
        const cleanContent = storedContent.slice(endIdx + META_SUFFIX.length).replace(/^\n/, '');
        return { content: cleanContent, meta };
      } catch (e) {
        // ignore parse error
      }
    }
  }
  return { content: storedContent, meta: {} };
}

export const postService = {
  async getPosts(ideaId) {
    if (isSupabaseConfigured) {
      try {
        // Query base posts with joined profiles, attachments, reactions
        // Only select columns guaranteed to exist in Supabase schema
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            idea_id,
            user_id,
            content,
            created_at,
            user:profiles!posts_user_id_fkey(id, email, display_name, avatar_url),
            attachments:post_attachments(*),
            reactions:post_reactions(*, user:profiles!post_reactions_user_id_fkey(id, email, display_name, avatar_url))
          `)
          .eq('idea_id', ideaId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          const mapped = data.map(p => {
            const { content: cleanContent, meta } = decodePostContent(p.content);
            const sender_type = p.sender_type || meta.sender_type || 'user';
            const agent_name = p.agent_name || meta.agent_name || null;
            const ai_metadata = p.ai_metadata || meta.ai_metadata || null;
            const reply_to = p.reply_to || meta.reply_to || null;
            const is_system = p.is_system || meta.is_system || false;

            const isIdvy = agent_name === 'idvy' || sender_type === 'ai';
            return {
              ...p,
              content: cleanContent,
              sender_type,
              agent_name,
              ai_metadata,
              reply_to,
              is_system,
              user: isIdvy ? {
                id: '00000000-0000-0000-0000-000000001d71',
                display_name: 'Idvy',
                email: 'idvy@ideate.app',
                avatar_url: '/avatars/idvy-avatar.avif'
              } : p.user,
              timestamp: new Date(p.created_at).getTime(),
              created_at: formatTimestamp(p.created_at),
              reactions: p.reactions || []
            };
          });

          // Extract any AI permissions sync posts to update local permissions cache
          const permPosts = mapped.filter(p => 
            p.agent_name === 'ai_permissions' || 
            p.ai_metadata?.type === 'ai_permissions_update' || 
            (typeof p.content === 'string' && p.content.startsWith('[AI_PERMISSIONS_SYNC]'))
          );
          if (permPosts.length > 0) {
            import('./aiService').then(({ aiService }) => {
              permPosts.forEach(pp => {
                const fullMap = pp.ai_metadata?.full_map;
                if (fullMap) {
                  aiService.syncPermissionsCache(ideaId, fullMap);
                }
              });
            }).catch(() => {});
          }

          // Filter out internal sync posts so they never display in visible chat
          const visiblePosts = mapped.filter(p => 
            p.agent_name !== 'ai_permissions' && 
            p.ai_metadata?.type !== 'ai_permissions_update' && 
            !(typeof p.content === 'string' && p.content.startsWith('[AI_PERMISSIONS_SYNC]'))
          );

          // Sync to localStore cache
          try {
            localStore.savePosts(visiblePosts);
          } catch (_) {}

          return visiblePosts;
        } else if (error) {
          console.warn('Supabase getPosts notice:', error.message);
        }
      } catch (err) {
        console.warn('Supabase getPosts error:', err.message);
      }
    }

    return localStore.getPosts(ideaId);
  },

  async createPost(ideaId, { content, attachments = [], reply_to = null, sender_type = 'user', agent_name = null, ai_metadata = null }, currentUser) {
    const formattedTime = formatTimestamp(new Date());

    if (isSupabaseConfigured) {
      try {
        // Resolve valid user_id for Supabase foreign key + RLS
        // If currentUser is the IDVY_BOT_USER, use the active authenticated session user ID
        let effectiveUserId = currentUser?.id;
        if (!effectiveUserId || effectiveUserId === '00000000-0000-0000-0000-000000001d71') {
          const authUser = (await supabase.auth.getUser())?.data?.user;
          effectiveUserId = authUser?.id || ideaId;
        }

        // Encode metadata directly into content so it NEVER fails regardless of DB columns!
        const encodedContent = encodePostContent(content, {
          sender_type,
          agent_name,
          ai_metadata,
          reply_to,
          is_system: false
        });

        let post = null;
        let postError = null;

        // Try insert with native extended columns first (in case migration was run)
        const fullPayload = {
          idea_id: ideaId,
          user_id: effectiveUserId,
          content: encodedContent,
          reply_to: reply_to || null,
          is_system: false,
          sender_type: sender_type || 'user',
          agent_name: agent_name || null,
          ai_metadata: ai_metadata || null
        };

        const res = await supabase.from('posts').insert(fullPayload).select().single();
        if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
          // Extended columns don't exist in DB — fallback to base columns with encoded content!
          const basePayload = {
            idea_id: ideaId,
            user_id: effectiveUserId,
            content: encodedContent
          };
          const baseRes = await supabase.from('posts').insert(basePayload).select().single();
          post = baseRes.data;
          postError = baseRes.error;
        } else {
          post = res.data;
          postError = res.error;
        }

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

          // Asynchronously dispatch notifications and push alerts
          if (sender_type !== 'ai') {
            notificationService.notifyPostCreated({
              post,
              ideaId,
              authorUser: currentUser
            }).catch(() => {});
          }

          const authorUser = agent_name === 'idvy' || sender_type === 'ai'
            ? {
                id: '00000000-0000-0000-0000-000000001d71',
                display_name: 'Idvy',
                email: 'idvy@ideate.app',
                avatar_url: '/avatars/idvy-avatar.avif'
              }
            : {
                id: currentUser.id,
                display_name: currentUser.display_name,
                email: currentUser.email,
                avatar_url: currentUser.avatar_url
              };

          const fullCreatedPost = {
            ...post,
            content, // Return clean un-encoded content to UI
            sender_type,
            agent_name,
            ai_metadata,
            reply_to,
            is_system: false,
            created_at: formattedTime,
            user: authorUser,
            attachments: createdAttachments,
            reactions: []
          };

          // Also cache locally
          try {
            const cached = localStore.getPosts(ideaId);
            localStore.savePosts([...cached, fullCreatedPost]);
          } catch (_) {}

          return fullCreatedPost;
        }
      } catch (err) {
        console.warn('Supabase createPost error (falling back to local storage):', err.message);
      }
    }

    // Offline cache / Local store fallback
    const posts = localStore.getPosts(ideaId);
    const authorUser = agent_name === 'idvy'
      ? {
          id: '00000000-0000-0000-0000-000000001d71',
          display_name: 'Idvy',
          email: 'idvy@ideate.app',
          avatar_url: '/avatars/idvy-avatar.avif'
        }
      : {
          id: currentUser.id,
          display_name: currentUser.display_name,
          email: currentUser.email,
          avatar_url: currentUser.avatar_url
        };

    const newPost = {
      id: 'post-' + Date.now(),
      idea_id: ideaId,
      user_id: authorUser.id,
      sender_type,
      agent_name,
      ai_metadata,
      user: authorUser,
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

  /**
   * Pre-allocates an AI message placeholder row directly in Supabase
   */
  async createAIPendingPost({ ideaId, senderType = 'ai', agentName = 'idvy', command = null, targetMember = null }, currentUser) {
    return this.createPost(ideaId, {
      content: '',
      sender_type: senderType,
      agent_name: agentName,
      ai_metadata: {
        status: 'generating',
        is_streaming: true,
        command,
        targetMember,
        started_at: new Date().toISOString()
      }
    }, currentUser);
  },

  /**
   * Updates an existing post in Supabase with encoded metadata
   */
  async updatePost(postId, { content, sender_type = 'ai', agent_name = 'idvy', ai_metadata = null }) {
    if (isSupabaseConfigured) {
      try {
        const encodedContent = encodePostContent(content, {
          sender_type,
          agent_name,
          ai_metadata,
          is_system: false
        });

        // Try update with full columns first
        const { data, error } = await supabase
          .from('posts')
          .update({
            content: encodedContent,
            sender_type,
            agent_name,
            ai_metadata
          })
          .eq('id', postId)
          .select()
          .single();

        if (error && (error.code === '42703' || error.message?.includes('column'))) {
          // Fallback to updating content only
          const baseRes = await supabase
            .from('posts')
            .update({ content: encodedContent })
            .eq('id', postId)
            .select()
            .single();

          if (!baseRes.error && baseRes.data) {
            const { content: clean, meta } = decodePostContent(baseRes.data.content);
            return {
              ...baseRes.data,
              content: clean,
              sender_type: baseRes.data.sender_type || meta.sender_type || sender_type,
              agent_name: baseRes.data.agent_name || meta.agent_name || agent_name,
              ai_metadata: baseRes.data.ai_metadata || meta.ai_metadata || ai_metadata
            };
          }
        }

        if (data) {
          const { content: clean, meta } = decodePostContent(data.content);
          return {
            ...data,
            content: clean,
            sender_type: data.sender_type || meta.sender_type || sender_type,
            agent_name: data.agent_name || meta.agent_name || agent_name,
            ai_metadata: data.ai_metadata || meta.ai_metadata || ai_metadata
          };
        }
      } catch (err) {
        console.warn('postService.updatePost error:', err);
      }
    }
    return null;
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
   * Delete all Idvy messages from an idea
   */
  async deleteIdvyPosts(ideaId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('posts')
          .delete()
          .eq('idea_id', ideaId)
          .or('agent_name.eq.idvy,sender_type.eq.ai,user_id.eq.00000000-0000-0000-0000-000000001d71');
        if (!error) return true;
        console.warn('Supabase deleteIdvyPosts error:', error.message);
      } catch (err) {
        console.warn('Supabase deleteIdvyPosts error:', err.message);
      }
    }

    let posts = localStore.getPosts(ideaId);
    posts = posts.filter(p => p.agent_name !== 'idvy' && p.sender_type !== 'ai' && p.user_id !== '00000000-0000-0000-0000-000000001d71');
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

  subscribeToPosts(ideaId, onNewPost, onDeletePost, onReactionChange, onUpdatePost) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel(`idea-posts-${ideaId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: `idea_id=eq.${ideaId}`
      }, async (payload) => {
        // Fetch full post with user profile using base columns
        const { data } = await supabase
          .from('posts')
          .select(`
            id,
            idea_id,
            user_id,
            content,
            created_at,
            user:profiles!posts_user_id_fkey(id, email, display_name, avatar_url),
            attachments:post_attachments(*),
            reactions:post_reactions(*, user:profiles!post_reactions_user_id_fkey(id, email, display_name, avatar_url))
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          const { content: cleanContent, meta } = decodePostContent(data.content);
          const sender_type = data.sender_type || meta.sender_type || 'user';
          const agent_name = data.agent_name || meta.agent_name || null;
          const ai_metadata = data.ai_metadata || meta.ai_metadata || null;
          const reply_to = data.reply_to || meta.reply_to || null;
          const is_system = data.is_system || meta.is_system || false;

          const isIdvy = agent_name === 'idvy' || sender_type === 'ai';

          // Check if this is an internal permissions sync message
          if (
            agent_name === 'ai_permissions' || 
            ai_metadata?.type === 'ai_permissions_update' || 
            (typeof cleanContent === 'string' && cleanContent.startsWith('[AI_PERMISSIONS_SYNC]'))
          ) {
            import('./aiService').then(({ aiService }) => {
              if (ai_metadata?.full_map) {
                aiService.syncPermissionsCache(ideaId, ai_metadata.full_map);
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ideate:ai_permissions_updated', {
                  detail: {
                    ideaId,
                    userId: ai_metadata?.user_id,
                    permissions: ai_metadata?.permissions,
                    full_map: ai_metadata?.full_map
                  }
                }));
              }
            }).catch(() => {});
            return; // Do NOT push to chat timeline!
          }

          onNewPost({
            ...data,
            content: cleanContent,
            sender_type,
            agent_name,
            ai_metadata,
            reply_to,
            is_system,
            user: isIdvy ? {
              id: '00000000-0000-0000-0000-000000001d71',
              display_name: 'Idvy',
              email: 'idvy@ideate.app',
              avatar_url: '/avatars/idvy-avatar.avif'
            } : data.user,
            timestamp: new Date(data.created_at).getTime(),
            created_at: formatTimestamp(data.created_at),
            reactions: data.reactions || []
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts',
        filter: `idea_id=eq.${ideaId}`
      }, async (payload) => {
        if (!onUpdatePost || !payload.new) return;
        const { data } = await supabase
          .from('posts')
          .select(`
            id,
            idea_id,
            user_id,
            content,
            created_at,
            user:profiles!posts_user_id_fkey(id, email, display_name, avatar_url),
            attachments:post_attachments(*),
            reactions:post_reactions(*, user:profiles!post_reactions_user_id_fkey(id, email, display_name, avatar_url))
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          const { content: cleanContent, meta } = decodePostContent(data.content);
          const sender_type = data.sender_type || meta.sender_type || 'user';
          const agent_name = data.agent_name || meta.agent_name || null;
          const ai_metadata = data.ai_metadata || meta.ai_metadata || null;
          const reply_to = data.reply_to || meta.reply_to || null;
          const is_system = data.is_system || meta.is_system || false;

          const isIdvy = agent_name === 'idvy' || sender_type === 'ai';

          onUpdatePost({
            ...data,
            content: cleanContent,
            sender_type,
            agent_name,
            ai_metadata,
            reply_to,
            is_system,
            user: isIdvy ? {
              id: '00000000-0000-0000-0000-000000001d71',
              display_name: 'Idvy',
              email: 'idvy@ideate.app',
              avatar_url: '/avatars/idvy-avatar.avif'
            } : data.user,
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
