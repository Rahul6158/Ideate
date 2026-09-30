// ==============================================================================
// Client-Side AI Service for Idvy — The AI Idea Collaborator
// Orchestrates requests to /api/idvy-chat and Supabase Edge Function idvy-chat
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const IDVY_BOT_USER = {
  id: '00000000-0000-0000-0000-000000001d71',
  user_id: '00000000-0000-0000-0000-000000001d71',
  display_name: 'Idvy',
  email: 'idvy@ideate.app',
  avatar_url: '/avatars/idvy-avatar.avif',
  role: 'AI Collaborator',
  is_ai: true
};

export const IDVY_WELCOME_TEXT = `Hey everyone! 👋 I'm Idvy, your idea collaborator and enthusiastic teammate!

I'm super excited to jump in with you and help bring this idea to life! Whenever you need a hand, I can help you with:
- 💡 Brainstorming & evolving concepts: mention @Idvy or use /coreidea and /improve
- 🔍 Rigorously validating proposals & spotting blind spots: use /validate or /risks
- 📋 Keeping everyone organized: use /summarize, /decisions, and /actionitems
- 🌐 Looking up market trends & live sources: use /websearch or /research

Just tag @Idvy or type / anytime you want to chat. Can't wait to build something amazing together! 🚀`;

export const IDVY_SLASH_COMMANDS = [
  { command: 'summarize', description: 'Summarize the entire discussion', syntax: '/summarize', category: 'Summary', requiresParam: false },
  { command: 'offtherecord', description: 'Open confidential off-the-record chat about this idea', syntax: '/offtherecord [query]', category: 'Off-the-Record', requiresParam: false, paramName: 'optional query' },
  { command: 'inidchat', description: 'Have Idvy post directly into the idea chat as an independent collaborator', syntax: '/inidchat [instruction]', category: 'Off-the-Record', requiresParam: true, paramName: 'instruction' },
  { command: 'private', description: 'Open confidential off-the-record chat about this idea', syntax: '/private [query]', category: 'Off-the-Record', requiresParam: false, paramName: 'optional query' },
  { command: 'summarize-private', description: 'Summarize discussion in confidential off-the-record drawer', syntax: '/summarize-private', category: 'Off-the-Record', requiresParam: false },
  { command: 'summarize @member', description: "Summarize one member's contributions", syntax: '/summarize @member', category: 'Summary', requiresParam: true, paramName: '@member' },
  { command: 'coreidea', description: 'Extract the current core idea evolution', syntax: '/coreidea', category: 'Strategy', requiresParam: false },
  { command: 'validate', description: 'Deeply evaluate proposal (strengths, assumptions, risks)', syntax: '/validate [proposal]', category: 'Strategy', requiresParam: true, paramName: 'proposal' },
  { command: 'validate @member', description: "Evaluate a member's specific contribution", syntax: '/validate @member', category: 'Strategy', requiresParam: true, paramName: '@member' },
  { command: 'decisions', description: 'Extract all confirmed decisions vs ongoing suggestions', syntax: '/decisions', category: 'Organization', requiresParam: false },
  { command: 'actionitems', description: 'Extract proposed action items and next steps', syntax: '/actionitems', category: 'Organization', requiresParam: false },
  { command: 'openquestions', description: 'Identify unresolved questions and uncertainties', syntax: '/openquestions', category: 'Organization', requiresParam: false },
  { command: 'improve', description: 'Suggest creative improvements to elevate the concept', syntax: '/improve [optional angle]', category: 'Ideation', requiresParam: false },
  { command: 'risks', description: 'Identify market, technical, and operational vulnerabilities', syntax: '/risks', category: 'Ideation', requiresParam: false },
  { command: 'websearch', description: 'Search the live web with citations & excerpts', syntax: '/websearch [query]', category: 'Research', requiresParam: true, paramName: 'query' },
  { command: 'research', description: 'Conduct in-depth market and competitor research', syntax: '/research [topic]', category: 'Research', requiresParam: true, paramName: 'topic' },
  { command: 'pause', description: 'Pause Idvy from auto-responding when tagged in this idea', syntax: '/pause', category: 'Control', requiresParam: false },
  { command: 'resume', description: 'Resume Idvy active collaboration in this idea', syntax: '/resume', category: 'Control', requiresParam: false },
  { command: 'help', description: 'Display command documentation and guidance', syntax: '/help', category: 'Info', requiresParam: false }
];

export const aiService = {
  getBotUser() {
    return IDVY_BOT_USER;
  },

  /**
   * Checks whether the current text mentions Idvy or invokes a slash command
   */
  shouldTriggerIdvy(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    const hasMention = /(^|\s)@idvy\b/i.test(trimmed);
    const hasSlash = /^\/[a-zA-Z0-9._]+/.test(trimmed);
    return hasMention || hasSlash;
  },

  /**
   * Parse user input into command and arguments
   */
  parseInput(text) {
    if (!text) return { command: null, args: '', targetMember: null, cleanedText: '' };
    const trimmed = text.trim();

    // Check for slash command
    const slashMatch = trimmed.match(/(?:^|\s)\/([a-zA-Z0-9._]+)(?:\s+(.*))?$/s);
    let command = null;
    let args = '';
    let targetMember = null;

    if (slashMatch) {
      command = slashMatch[1].toLowerCase();
      args = (slashMatch[2] || '').trim();

      const memberMatch = args.match(/@([a-zA-Z0-9_.-]+)/);
      if (memberMatch) targetMember = memberMatch[1];
    }

    const cleanedText = trimmed.replace(/@idvy\b/gi, '').trim();

    return {
      command,
      args,
      targetMember,
      cleanedText
    };
  },

  /**
   * Check if Idvy is paused globally across the entire platform
   */
  isGlobalPaused() {
    try {
      return localStorage.getItem('ideate_global_idvy_paused') === 'true';
    } catch (_) {
      return false;
    }
  },

  /**
   * Set global Idvy pause (admin only)
   */
  async setGlobalPause(isPaused, adminUser = null) {
    try {
      localStorage.setItem('ideate_global_idvy_paused', isPaused ? 'true' : 'false');
    } catch (_) {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('platform_settings')
          .upsert({
            key: 'global_idvy_paused',
            value: isPaused ? 'true' : 'false',
            updated_by: adminUser?.id || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (_) {}
    }
    return isPaused;
  },

  /**
   * Check if an individual user has been banned from using AI by platform admin
   */
  isUserAIBanned(userId) {
    if (!userId) return false;
    try {
      const banned = JSON.parse(localStorage.getItem('ideate_ai_banned_users') || '[]');
      return Array.isArray(banned) && banned.includes(userId);
    } catch (_) {
      return false;
    }
  },

  /**
   * Toggle user AI access globally across the platform (admin only)
   */
  async setUserAIAccess(userId, hasAccess) {
    if (!userId) return;
    try {
      const banned = JSON.parse(localStorage.getItem('ideate_ai_banned_users') || '[]');
      const set = new Set(banned);
      if (hasAccess) {
        set.delete(userId);
      } else {
        set.add(userId);
      }
      localStorage.setItem('ideate_ai_banned_users', JSON.stringify([...set]));
    } catch (_) {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ can_use_ai: hasAccess })
          .eq('id', userId);
      } catch (_) {}
    }
    return hasAccess;
  },

  /**
   * Get pause state for a specific idea space
   */
  getIdeaPauseState(ideaId) {
    if (!ideaId) return { is_paused: false, paused_by_admin: false };
    try {
      const saved = localStorage.getItem(`idvy_pause_${ideaId}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return { is_paused: false, paused_by_admin: false };
  },

  /**
   * Set pause state for an idea space. If paused by admin, non-admins cannot resume.
   */
  setIdeaPaused(ideaId, isPaused, byAdmin = false) {
    if (!ideaId) return { is_paused: false, paused_by_admin: false };
    const current = this.getIdeaPauseState(ideaId);

    // If current was paused by admin, and caller is not admin, reject unpause
    if (current.paused_by_admin && !byAdmin && !isPaused) {
      throw new Error('Idvy was paused by a platform administrator. Only an admin can resume Idvy in this space.');
    }

    const nextState = {
      is_paused: isPaused,
      paused_by_admin: isPaused ? (byAdmin || current.paused_by_admin) : false,
      updated_at: new Date().toISOString()
    };

    try {
      localStorage.setItem(`idvy_pause_${ideaId}`, JSON.stringify(nextState));
    } catch (_) {}

    return nextState;
  },

  /**
   * Check AI permission for a user in an idea
   * Rules:
   * 1. Global pause overrides everything
   * 2. Admin user ban revokes AI access for that user
   * 4. Regular members only have access if explicitly granted by owner or admin
   */
  async checkAIAccess(ideaId, userId, isOwner = false, isAdmin = false, membersList = []) {
    // 1. Check Global Pause
    if (this.isGlobalPaused()) {
      return { 
        can_use_ai: false, 
        is_ai_enabled: false, 
        is_globally_paused: true, 
        reason: 'global_paused',
        message: 'Idvy is temporarily paused globally by system administrators.' 
      };
    }

    // 2. Check Admin User Ban
    if (this.isUserAIBanned(userId)) {
      return { 
        can_use_ai: false, 
        is_ai_enabled: false, 
        is_user_restricted: true, 
        reason: 'user_restricted',
        message: 'Your AI access has been restricted by an administrator.' 
      };
    }

    // 3. Check Idea-level pause state
    const ideaPause = this.getIdeaPauseState(ideaId);
    const isIdeaPaused = ideaPause.is_paused;
    const isPausedByAdmin = ideaPause.paused_by_admin;

    // Admin has full access to everything
    if (isAdmin) {
      return { 
        can_use_ai: true,
        can_use_otr: true,
        can_tag_ai: true,
        is_ai_enabled: !isIdeaPaused, 
        is_paused: isIdeaPaused,
        is_paused_by_admin: isPausedByAdmin,
        is_admin: true 
      };
    }

    // Idea Owner has full access to everything by default unless idea is paused
    if (isOwner) {
      return { 
        can_use_ai: true,
        can_use_otr: true,
        can_tag_ai: true,
        is_ai_enabled: !isIdeaPaused, 
        is_paused: isIdeaPaused,
        is_paused_by_admin: isPausedByAdmin,
        is_owner: true 
      };
    }

    // 4. Regular Member: Evaluate granular permissions (Off-Chat & Tagging independently)
    let canUseOTR = false;
    let canTagAI = false;

    // A. Check localStorage permissions map for this idea
    try {
      const saved = localStorage.getItem(`idvy_access_${ideaId}`);
      if (saved) {
        const localAccess = JSON.parse(saved);
        if (localAccess.members && localAccess.members[userId] !== undefined) {
          const userPerm = localAccess.members[userId];
          if (typeof userPerm === 'boolean') {
            canUseOTR = userPerm;
            canTagAI = userPerm;
          } else if (userPerm && typeof userPerm === 'object') {
            canUseOTR = userPerm.can_use_otr === true;
            canTagAI = userPerm.can_tag_ai === true;
          }
        }
      }
    } catch (_) {}

    // B. Check membersList in memory if passed
    if (Array.isArray(membersList) && membersList.length > 0 && userId) {
      const found = membersList.find(m => m.user_id === userId || m.id === userId);
      if (found) {
        if (typeof found.can_use_otr === 'boolean') canUseOTR = found.can_use_otr;
        if (typeof found.can_tag_ai === 'boolean') canTagAI = found.can_tag_ai;

        const roleStr = String(found.role || '').toLowerCase();
        if (roleStr.includes('otr')) canUseOTR = true;
        if (roleStr.includes('tag')) canTagAI = true;
        if (roleStr.includes('member:ai') && !roleStr.includes('otr') && !roleStr.includes('tag')) {
          // Legacy generic AI grant
          canUseOTR = true;
          canTagAI = true;
        }
      }
    }

    // C. Check Supabase idea_members table role for granular flags
    if ((!canUseOTR || !canTagAI) && isSupabaseConfigured && supabase && userId) {
      try {
        const { data: memberRow } = await supabase
          .from('idea_members')
          .select('role')
          .eq('idea_id', ideaId)
          .eq('user_id', userId)
          .maybeSingle();

        if (memberRow && typeof memberRow.role === 'string') {
          const roleStr = memberRow.role.toLowerCase();
          if (roleStr.includes('otr')) canUseOTR = true;
          if (roleStr.includes('tag')) canTagAI = true;
          if (roleStr.includes('member:ai') && !roleStr.includes('otr') && !roleStr.includes('tag')) {
            canUseOTR = true;
            canTagAI = true;
          }
        }
      } catch (_) {}
    }

    const hasAnyAccess = canUseOTR || canTagAI;

    return { 
      can_use_ai: hasAnyAccess,
      can_use_otr: canUseOTR,
      can_tag_ai: canTagAI,
      is_ai_enabled: !isIdeaPaused, 
      is_paused: isIdeaPaused,
      is_paused_by_admin: isPausedByAdmin,
      is_member: true,
      reason: hasAnyAccess ? null : 'member_not_granted',
      message: hasAnyAccess ? null : 'AI access is reserved for the idea owner by default. Ask the owner to grant you Idvy access.'
    };
  },

  /**
   * Syncs entire permissions map into local storage cache
   */
  syncPermissionsCache(ideaId, fullMap) {
    if (!ideaId || !fullMap) return;
    try {
      const saved = localStorage.getItem(`idvy_access_${ideaId}`) || '{}';
      const parsed = JSON.parse(saved);
      if (!parsed.members) parsed.members = {};
      Object.assign(parsed.members, fullMap);
      localStorage.setItem(`idvy_access_${ideaId}`, JSON.stringify(parsed));
    } catch (_) {}
  },

  /**
   * Get granular access for a user in an idea
   */
  getMemberGranularAccess(ideaId, userId) {
    if (!ideaId || !userId) return { can_use_otr: false, can_tag_ai: false };
    try {
      const saved = localStorage.getItem(`idvy_access_${ideaId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const item = parsed.members?.[userId];
        if (typeof item === 'boolean') {
          return { can_use_otr: item, can_tag_ai: item };
        }
        if (item && typeof item === 'object') {
          return {
            can_use_otr: item.can_use_otr === true,
            can_tag_ai: item.can_tag_ai === true
          };
        }
      }
    } catch (_) {}
    return { can_use_otr: false, can_tag_ai: false };
  },

  /**
   * Set granular AI access for a member (Off-Chat and Tagging independently)
   * Synchronizes across localStorage, Supabase Realtime system sync post, and idea_members role.
   */
  async setMemberGranularAccess(ideaId, userId, permissions, allMembersMap = null, currentUser = null) {
    const granular = {
      can_use_otr: permissions.can_use_otr === true,
      can_tag_ai: permissions.can_tag_ai === true
    };

    // 1. Update localStorage cache
    let updatedMap = {};
    try {
      const saved = localStorage.getItem(`idvy_access_${ideaId}`) || '{}';
      const parsed = JSON.parse(saved);
      if (!parsed.members) parsed.members = {};
      parsed.members[userId] = granular;
      if (allMembersMap) {
        Object.assign(parsed.members, allMembersMap);
      }
      updatedMap = { ...parsed.members };
      localStorage.setItem(`idvy_access_${ideaId}`, JSON.stringify(parsed));
    } catch (_) {}

    // 2. Broadcast via Supabase Realtime system post (guarantees cross-account instant sync without re-login)
    if (isSupabaseConfigured && ideaId) {
      try {
        const { postService } = await import('./postService');
        await postService.createPost(ideaId, {
          content: '[AI_PERMISSIONS_SYNC]',
          sender_type: 'system',
          is_system: true,
          agent_name: 'ai_permissions',
          ai_metadata: {
            type: 'ai_permissions_update',
            idea_id: ideaId,
            user_id: userId,
            permissions: granular,
            full_map: updatedMap
          }
        }, currentUser);
      } catch (postErr) {
        console.warn('Realtime permission sync post notice:', postErr);
      }
    }

    // 3. Persist to Supabase idea_members table role as fallback
    if (isSupabaseConfigured && supabase && ideaId && userId) {
      try {
        const roleTag = granular.can_use_otr && granular.can_tag_ai
          ? 'member:ai:otr,tag'
          : granular.can_use_otr
            ? 'member:ai:otr'
            : granular.can_tag_ai
              ? 'member:ai:tag'
              : 'member';

        await supabase
          .from('idea_members')
          .update({ role: roleTag })
          .match({ idea_id: ideaId, user_id: userId });
      } catch (err) {
        console.warn('setMemberGranularAccess idea_members update fallback:', err);
      }
    }

    // 4. Dispatch browser CustomEvent for immediate same-tab reactive update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ideate:ai_permissions_updated', {
        detail: {
          ideaId,
          userId,
          permissions: granular,
          full_map: updatedMap
        }
      }));
    }

    return { idea_id: ideaId, user_id: userId, ...granular };
  },

  /**
   * Legacy wrapper: set member AI access (grants/revokes both permissions)
   */
  async setMemberAIAccess(ideaId, userId, canUseAi, allMembersMap = null, currentUser = null) {
    return this.setMemberGranularAccess(
      ideaId, 
      userId, 
      { can_use_otr: !!canUseAi, can_tag_ai: !!canUseAi }, 
      allMembersMap, 
      currentUser
    );
  },

  /**
   * Enable or disable AI for an idea (Owner or Admin)
   */
  async toggleAIForIdea(ideaId, isEnabled, byAdmin = false) {
    this.setIdeaPaused(ideaId, !isEnabled, byAdmin);
    return true;
  },

  /**
   * Retrieve AI Memory for an idea
   */
  async getAIMemory(ideaId) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('idea_ai_memory')
          .select('*')
          .eq('idea_id', ideaId)
          .maybeSingle();
        if (data) return data;
      } catch (_) {}
    }
    return null;
  },

  /**
   * Send prompt to Idvy through serverless backend
   */
  async queryIdvy({
    ideaId,
    userPrompt,
    idea,
    members = [],
    posts = [],
    callerUser
  }) {
    const parsed = this.parseInput(userPrompt);

    // Verify AI access permission
    const isOwner = idea?.owner_id === callerUser?.id || idea?.user_id === callerUser?.id;
    const isAdmin = callerUser?.role === 'admin' || callerUser?.email === 'tushrahul58@gmail.com';
    const access = await this.checkAIAccess(ideaId, callerUser?.id, isOwner, isAdmin);

    if (access.is_globally_paused) {
      throw new Error('Idvy is currently paused across the platform by administrators.');
    }
    if (access.is_user_restricted) {
      throw new Error('Your AI access has been disabled by an administrator.');
    }
    if (access.is_paused) {
      throw new Error(access.is_paused_by_admin 
        ? 'Idvy is currently paused in this idea space by a platform administrator.' 
        : 'Idvy is currently paused in this idea space. Resume Idvy to continue chatting.');
    }
    if (!access.can_use_ai) {
      throw new Error(access.message || 'You do not have permission to invoke Idvy in this idea space.');
    }

    // Try Edge Function first, then fallback to /api/idvy-chat
    let token = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      } catch (_) {}
    }

    const payload = {
      ideaId,
      userPrompt,
      idea: {
        id: idea?.id,
        title: idea?.title,
        description: idea?.description,
        owner_id: idea?.owner_id
      },
      members: members.map(m => ({
        id: m.id || m.user_id,
        display_name: m.display_name,
        email: m.email,
        role: m.role
      })),
      posts: posts.slice(-30).map(p => ({
        id: p.id,
        content: p.content,
        sender_type: p.sender_type || (p.agent_name === 'idvy' ? 'ai' : 'user'),
        agent_name: p.agent_name,
        created_at: p.created_at,
        user: {
          display_name: p.user?.display_name,
          email: p.user?.email
        }
      })),
      command: parsed.command,
      args: parsed.args,
      targetMember: parsed.targetMember,
      callerUser: callerUser ? {
        id: callerUser.id,
        display_name: callerUser.display_name,
        email: callerUser.email
      } : null
    };

    let response = null;

    // 1. Try local/Vercel proxy /api/idvy-chat
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/idvy-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        response = await res.json();
      }
    } catch (apiErr) {
      console.warn('API /api/idvy-chat attempt failed:', apiErr.message);
    }

    // 2. If /api/idvy-chat failed, try Supabase Edge Function directly
    if (!response && isSupabaseConfigured && supabase) {
      try {
        const edgeRes = await supabase.functions.invoke('idvy-chat', {
          body: payload
        });
        if (edgeRes.data) {
          response = edgeRes.data;
        }
      } catch (edgeErr) {
        console.warn('Supabase functions invoke idvy-chat error:', edgeErr.message);
      }
    }

    if (!response) {
      throw new Error('Unable to connect to Idvy AI service. Please verify your connection.');
    }

    return response;
  },

  /**
   * Alias for calling Idvy chat from private or external modules
   */
  async callIdvyChat(params = {}) {
    return this.queryIdvy({
      ideaId: params.ideaId,
      userPrompt: params.userPrompt || params.prompt || '',
      idea: params.idea || { id: params.ideaId },
      members: params.members || [],
      posts: params.posts || [],
      callerUser: params.callerUser
    });
  }
};
