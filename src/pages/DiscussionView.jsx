import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  Plus, 
  MessageSquare,
  Pencil,
  Trash2,
  Info,
  Eraser,
  Settings,
  Copy,
  Check,
  Bell,
  BellOff,
  Sparkles,
  Lock,
  EyeOff,
  Pause,
  Play
} from 'lucide-react';
import PostItem from '../components/posts/PostItem';
import PostComposer from '../components/posts/PostComposer';
import DeletePostModal from '../components/posts/DeletePostModal';
import ClearMessagesModal from '../components/posts/ClearMessagesModal';
import UserMessagesSidebar from '../components/posts/UserMessagesSidebar';
import AddMemberModal from '../components/ideas/AddMemberModal';
import MembersSheet from '../components/ideas/MembersSheet';
import IdvyTypingIndicator from '../components/ai/IdvyTypingIndicator';
import AIAccessManagerModal from '../components/ai/AIAccessManagerModal';
import IdvyPrivateSidebar from '../components/ai/IdvyPrivateSidebar';
import IdeaInfoModal from '../components/ideas/IdeaInfoModal';
import NoticeModal from '../components/common/NoticeModal';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { aiService, IDVY_BOT_USER } from '../services/aiService';
import { postService } from '../services/postService';
import { memberService } from '../services/memberService';
import { useAuth } from '../context/AuthContext';
import { getRandomAvatar } from '../data/avatars';
import { notificationService } from '../services/notificationService';
import { pushNotificationService } from '../services/pushNotifications';
import { getIdeaTheme } from '../data/themePalettes';
import LoadingScreen from '../components/common/LoadingScreen';

export default function DiscussionView({ idea, onBack, onUpdateIdeaStats, onEditIdea, onDeleteIdea }) {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isMembersSheetOpen, setIsMembersSheetOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [showDescriptionTooltip, setShowDescriptionTooltip] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isMuted, setIsMuted] = useState(() =>
    pushNotificationService.isIdeaMuted(currentUser?.id, idea?.id)
  );
  const settingsMenuRef = useRef(null);

  useEffect(() => {
    setIsMuted(pushNotificationService.isIdeaMuted(currentUser?.id, idea?.id));
  }, [currentUser?.id, idea?.id]);

  const handleToggleMuteIdea = async () => {
    if (!currentUser?.id || !idea?.id) return;
    const updated = await pushNotificationService.toggleMuteIdea(currentUser.id, idea.id);
    setIsMuted(Array.isArray(updated?.muted_ideas) && updated.muted_ideas.includes(idea.id));
  };

  // Close settings menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSettingsOpen]);

  // Enhancements: Reply, Filter Person Messages, and Clear Messages
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedPersonForFilter, setSelectedPersonForFilter] = useState(null);
  const [isClearMessagesOpen, setIsClearMessagesOpen] = useState(false);
  const [isClearingMessages, setIsClearingMessages] = useState(false);
  
  // Role & Author determination
  const isOwner = idea?.owner_id === currentUser?.id || idea?.user_id === currentUser?.id || idea?.created_by === currentUser?.id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const canManage = isOwner || isAdmin;
  const isIdeaAuthor = isOwner;

  // Private chat thread state
  const [isPrivateSidebarOpen, setIsPrivateSidebarOpen] = useState(false);
  const [privateSidebarPrompt, setPrivateSidebarPrompt] = useState('');
  const [isIdeaInfoOpen, setIsIdeaInfoOpen] = useState(false);

  // In-App Notice Modal Configuration (replaces browser alerts)
  const [noticeModalConfig, setNoticeModalConfig] = useState({
    isOpen: false,
    badge: 'info',
    title: '',
    message: ''
  });

  // Composer prefill content (from Off-the-Record "Send to Input Box")
  const [composerPrefill, setComposerPrefill] = useState('');
  
  // Paused Idvy state (persisted per idea with admin lock support)
  const initialPause = aiService.getIdeaPauseState(idea?.id);
  const [isIdvyPaused, setIsIdvyPaused] = useState(initialPause.is_paused);
  const [isPausedByAdmin, setIsPausedByAdmin] = useState(initialPause.paused_by_admin);

  // Current user's AI access permission in this idea space (granular: OTR & Tagging)
  const [hasAIAccess, setHasAIAccess] = useState(true);
  const [canUseOTR, setCanUseOTR] = useState(true);
  const [canTagAI, setCanTagAI] = useState(true);
  const [aiAccessDetails, setAiAccessDetails] = useState(null);

  const verifyAccess = useCallback(async () => {
    if (!idea?.id || !currentUser?.id) return;
    const access = await aiService.checkAIAccess(idea.id, currentUser.id, isOwner, isAdmin, members);
    setHasAIAccess(access.can_use_ai);
    setCanUseOTR(access.can_use_otr === true || isOwner || isAdmin);
    setCanTagAI(access.can_tag_ai === true || isOwner || isAdmin);
    setAiAccessDetails(access);

    // If OTR was revoked while the private sidebar was open, close it
    if (!access.can_use_otr && !isOwner && !isAdmin) {
      setIsPrivateSidebarOpen(false);
    }
  }, [idea?.id, currentUser?.id, isOwner, isAdmin, members]);

  useEffect(() => {
    verifyAccess();
  }, [verifyAccess]);

  // Realtime permission sync listener (syncs across devices and accounts without page refresh)
  useEffect(() => {
    if (!idea?.id) return;
    const handlePermUpdate = async (e) => {
      if (e.detail?.ideaId === idea.id) {
        await verifyAccess();
      }
    };
    window.addEventListener('ideate:ai_permissions_updated', handlePermUpdate);
    return () => window.removeEventListener('ideate:ai_permissions_updated', handlePermUpdate);
  }, [idea?.id, verifyAccess]);

  // Handler to discuss any message with Idvy in Off-the-Record
  const handleAskIdvyInOTR = (post) => {
    if (!canUseOTR && !isOwner && !isAdmin) {
      setNoticeModalConfig({
        isOpen: true,
        badge: 'lock',
        title: 'Off-Chat Access Reserved',
        message: `Off-the-Record private AI chat is reserved for the idea owner by default.\n\nThe idea owner (@${idea.owner_name || 'Owner'}) can grant you Off-chat access from Idea Settings -> AI Permissions.`
      });
      return;
    }

    const sender = post.user_name || post.user?.display_name || (post.sender_type === 'ai' ? 'Idvy' : 'Member');
    const prompt = `Let's discuss this message from @${sender} off-the-record:\n\n"${post.content}"\n\nWhat are your thoughts and suggestions on this?`;
    
    setPrivateSidebarPrompt(prompt);
    setIsPrivateSidebarOpen(true);
  };

  // Handler to post directly to chat as Idvy (native Idvy styling, zero disclaimers)
  const handleSendAsIdvyToChat = async (aiContent) => {
    if (!aiContent || !idea?.id) return;
    try {
      await postService.createPost(idea.id, {
        content: aiContent,
        sender_type: 'ai',
        user_name: 'Idvy',
        agent_name: 'idvy',
        is_pinned: false,
        ai_metadata: {
          model: 'nemotron-70b',
          posted_from: 'off-the-record'
        }
      }, IDVY_BOT_USER);

      const refreshed = await postService.getPosts(idea.id);
      setPosts(refreshed);
      setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to post as Idvy:', err);
      setNoticeModalConfig({
        isOpen: true,
        badge: 'warning',
        title: 'Post Failed',
        message: err.message || 'Could not post Idvy response to idea chat. Please try again.'
      });
    }
  };

  // Handler to have Idvy answer the same question directly in the main team discussion
  const handleAnswerInMainChat = async ({ question, answer }) => {
    if (!idea?.id) return;
    try {
      if (question && question.trim()) {
        const questionPrompt = question.trim().startsWith('@Idvy') ? question.trim() : `@Idvy ${question.trim()}`;
        await handlePostCreated({ content: questionPrompt });
      } else if (answer) {
        await handleSendAsIdvyToChat(answer);
      }
    } catch (err) {
      console.warn('Failed to trigger answer in main chat:', err);
    }
  };

  const handleTogglePauseIdvy = (explicitState) => {
    const currentPause = aiService.getIdeaPauseState(idea?.id);
    const nextPaused = typeof explicitState === 'boolean' ? explicitState : !currentPause.is_paused;

    if (currentPause.paused_by_admin && !isAdmin && !nextPaused) {
      setNoticeModalConfig({
        isOpen: true,
        badge: 'warning',
        title: 'Action Restricted',
        message: 'Idvy was paused by a platform administrator. Only an administrator can resume Idvy in this idea space.'
      });
      return;
    }

    try {
      const updated = aiService.setIdeaPaused(idea.id, nextPaused, isAdmin);
      setIsIdvyPaused(updated.is_paused);
      setIsPausedByAdmin(updated.paused_by_admin);

      notificationService.addNotification({
        title: updated.is_paused ? 'Idvy Paused ⏸️' : 'Idvy Resumed ▶️',
        message: updated.is_paused 
          ? (isAdmin ? 'Idvy paused by Admin. Regular users cannot resume.' : 'Idvy is now paused in this idea space.') 
          : 'Idvy is now active and ready to collaborate!',
        type: 'system',
        ideaId: idea?.id,
        playSound: false
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAllIdvyPosts = async () => {
    try {
      await postService.deleteIdvyPosts(idea.id);
      setPosts(prev => prev.filter(p => p.agent_name !== 'idvy' && p.sender_type !== 'ai' && p.user_id !== IDVY_BOT_USER.id));
      if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
      notificationService.addNotification({
        title: 'Idvy Messages Cleared 🧹',
        message: 'All Idvy responses have been removed from this idea.',
        type: 'system',
        ideaId: idea.id,
        playSound: false
      });
    } catch (err) {
      alert('Failed to delete Idvy messages: ' + err.message);
    }
  };

  const timelineEndRef = useRef(null);

  // Load posts and members for this idea
  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      if (!idea?.id) return;
      setLoading(true);
      try {
        const [postsData, membersData] = await Promise.all([
          postService.getPosts(idea.id),
          memberService.getMembers(idea.id)
        ]);

        if (isSubscribed) {
          // Deduplicate initially loaded posts by id
          const uniquePosts = (postsData || []).filter((p, idx, arr) => 
            arr.findIndex(item => item.id === p.id) === idx
          );
          setPosts(uniquePosts);
          setMembers(membersData || []);

          // If brand new idea with no posts, immediately greet the creator
          if (uniquePosts.length === 0 && currentUser?.id) {
            const creatorName = currentUser?.display_name || currentUser?.email?.split('@')[0] || 'friend';
            const welcomeGreeting = `Hey @${creatorName}! 👋 I'm **Idvy**, your collaborative partner and idea friend! 🎉\n\nEven if it's just the two of us right now, don't worry—we've got this. I'm ready to dive into **"${idea.title || 'this idea'}"** with you!\n\nWhenever you want to bounce thoughts around, here are some things we can do together:\n- 💡 Brainstorm & sharpen the vision: type \`/coreidea\` or \`/improve\`\n- 🎯 Pressure-test ideas & spot blind spots: type \`/validate\`\n- 📋 Keep everything neat & organized: type \`/summarize\`, \`/decisions\`, or \`/actionitems\`\n- 🌐 Search trends & live web insights: type \`/websearch\` or \`/research\`\n\nOr just tag me anytime: **@Idvy**. Let's build something incredible together! ✨`;

            postService.createPost(idea.id, {
              content: welcomeGreeting,
              sender_type: 'ai',
              agent_name: 'idvy'
            }, currentUser).then(createdPost => {
              if (isSubscribed && createdPost) {
                setPosts([createdPost]);
              }
            }).catch(e => console.warn('Auto-welcome post creation error:', e));
          }

          // Automatically mark idea as read for current user
          if (currentUser?.id) {
            notificationService.markIdeaAsRead(currentUser.id, idea.id);
          }
        }
      } catch (err) {
        console.error('Failed to load discussion:', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadData();

    // Subscribe to realtime updates with deduplication and reactions sync
    const unsubscribe = postService.subscribeToPosts(
      idea.id, 
      (newPost) => {
        setPosts(prev => {
          const existingIdx = prev.findIndex(p => p.id === newPost.id);
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...newPost };
            return updated;
          }
          return [...prev, newPost];
        });
        // While actively viewing this idea, keep it marked as read
        if (currentUser?.id) {
          notificationService.markIdeaAsRead(currentUser.id, idea.id);
        }
        if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
      },
      (deletedPostId) => {
        setPosts(prev => prev.filter(p => p.id !== deletedPostId));
        if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
      },
      async (reactionPayload) => {
        // Realtime reaction sync from any user/account
        if (reactionPayload?.eventType === 'INSERT' && reactionPayload.new) {
          const item = reactionPayload.new;
          setPosts(prev => prev.map(p => {
            if (p.id === item.post_id) {
              const currentList = p.reactions || [];
              const exists = currentList.some(r => 
                (r.id && r.id === item.id) || 
                (r.user_id === item.user_id && r.emoji === item.emoji)
              );
              if (exists) return p;
              return { ...p, reactions: [...currentList, item] };
            }
            return p;
          }));
        } else if (reactionPayload?.eventType === 'DELETE' && reactionPayload.old) {
          const item = reactionPayload.old;
          setPosts(prev => prev.map(p => {
            if (p.id === item.post_id || (p.reactions || []).some(r => r.id === item.id)) {
              return {
                ...p,
                reactions: (p.reactions || []).filter(r => 
                  r.id !== item.id && 
                  !(item.user_id && r.user_id === item.user_id && r.emoji === item.emoji)
                )
              };
            }
            return p;
          }));
        } else {
          // If bulk change, refresh posts to guarantee exact reactions
          try {
            const freshPosts = await postService.getPosts(idea.id);
            if (freshPosts && isSubscribed) {
              setPosts(freshPosts);
            }
          } catch (_) {}
        }
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [idea?.id]);

  const [isAIAccessOpen, setIsAIAccessOpen] = useState(false);
  const [isIdvyThinking, setIsIdvyThinking] = useState(false);
  const [idvyStatus, setIdvyStatus] = useState('Idvy is reviewing the discussion...');

  // Handle post created with deduplication & Idvy AI invocation
  const handlePostCreated = async (postData) => {
    try {
      const userMessageContent = postData.content || '';

      // Intercept private chat / private summarize commands
      if (userMessageContent.trim().startsWith('/offtherecord') || userMessageContent.trim().startsWith('/private')) {
        const query = userMessageContent.trim().replace(/^\/(?:offtherecord|private)\s*/i, '').trim();
        setPrivateSidebarPrompt(query || '');
        setIsPrivateSidebarOpen(true);
        return;
      }

      if (userMessageContent.trim().startsWith('/summarize-private')) {
        setPrivateSidebarPrompt('Please summarize all member messages and key proposals privately.');
        setIsPrivateSidebarOpen(true);
        return;
      }

      // Intercept /pause and /resume slash commands
      const trimmed = userMessageContent.trim();
      const callerName = currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Friend';
      if (trimmed === '/pause' || trimmed.startsWith('/pause-idvy')) {
        handleTogglePauseIdvy(true);
        await postService.createPost(idea.id, {
          content: `⏸️ @${callerName} paused **Idvy** in this idea. Automatic responses and mentions are now paused. Type \`/resume\` or click Resume to activate her again.`,
          sender_type: 'system'
        });
        const refreshedPosts = await postService.getPosts(idea.id);
        setPosts(refreshedPosts);
        return;
      }

      if (trimmed === '/resume' || trimmed.startsWith('/resume-idvy') || trimmed === '/unpause') {
        handleTogglePauseIdvy(false);
        await postService.createPost(idea.id, {
          content: `▶️ **Idvy** has been resumed by @${callerName}! Ready to collaborate. Mention @Idvy anytime! ✨`,
          sender_type: 'system'
        });
        const refreshedPosts = await postService.getPosts(idea.id);
        setPosts(refreshedPosts);
        return;
      }

      // Intercept /give.ai.accto and /revoke.ai.accto slash commands
      if (trimmed.startsWith('/give.ai.accto') || trimmed.startsWith('/revoke.ai.accto')) {
        const isRevoke = trimmed.startsWith('/revoke.ai.accto');
        if (!isOwner && !isAdmin) {
          setNoticeModalConfig({
            isOpen: true,
            badge: 'lock',
            title: 'Permission Denied',
            message: `Only the idea owner (@${idea.owner_name || 'Owner'}) or an administrator can manage AI permissions.`
          });
          return;
        }

        const argsStr = trimmed.replace(isRevoke ? /^\/revoke\.ai\.accto\s*/ : /^\/give\.ai\.accto\s*/, '').trim();
        const parts = argsStr.split(/\s+/).filter(Boolean);
        const targetRaw = parts[0] || '';
        const scope = (parts[1] || 'both').toLowerCase();

        const cleanTarget = targetRaw.replace(/^@/, '').toLowerCase();
        const targetMember = (members || []).find(m => {
          const dName = (m.display_name || '').toLowerCase().replace(/\s+/g, '_');
          const dOrig = (m.display_name || '').toLowerCase();
          const emailPrefix = (m.email || '').split('@')[0].toLowerCase();
          return cleanTarget && (dName === cleanTarget || dOrig === cleanTarget || emailPrefix === cleanTarget || m.id === cleanTarget || m.user_id === cleanTarget);
        });

        if (!targetMember) {
          await postService.createPost(idea.id, {
            content: `⚠️ Could not find collaborator **${targetRaw || 'member'}**. Please specify a valid member username or tag, e.g.:\n\`/give.ai.accto @member otr\` or \`/revoke.ai.accto @member tag\``,
            sender_type: 'system'
          });
          const refreshedPosts = await postService.getPosts(idea.id);
          setPosts(refreshedPosts);
          return;
        }

        const targetUid = targetMember.user_id || targetMember.id;
        const currentPerms = aiService.getMemberGranularAccess(idea.id, targetUid);
        let nextPerms = { ...currentPerms };

        if (!isRevoke) {
          if (scope === 'otr' || scope === 'offchat' || scope === 'private') {
            nextPerms.can_use_otr = true;
          } else if (scope === 'tag' || scope === 'tagging' || scope === 'mention') {
            nextPerms.can_tag_ai = true;
          } else {
            nextPerms.can_use_otr = true;
            nextPerms.can_tag_ai = true;
          }
        } else {
          if (scope === 'otr' || scope === 'offchat' || scope === 'private') {
            nextPerms.can_use_otr = false;
          } else if (scope === 'tag' || scope === 'tagging' || scope === 'mention') {
            nextPerms.can_tag_ai = false;
          } else {
            nextPerms.can_use_otr = false;
            nextPerms.can_tag_ai = false;
          }
        }

        await aiService.setMemberGranularAccess(idea.id, targetUid, nextPerms, null, currentUser);
        const targetLabel = targetMember.display_name || targetMember.email?.split('@')[0] || 'member';

        let actionDescription = '';
        if (!isRevoke) {
          if (scope === 'otr') actionDescription = 'granted **Off-Chat (OTR)** access to';
          else if (scope === 'tag') actionDescription = 'granted **Tagging (@Idvy)** access to';
          else actionDescription = 'granted full Idvy access (**Off-Chat + Tagging**) to';
        } else {
          if (scope === 'otr') actionDescription = 'revoked **Off-Chat (OTR)** access from';
          else if (scope === 'tag') actionDescription = 'revoked **Tagging (@Idvy)** access from';
          else actionDescription = 'revoked all Idvy access from';
        }

        await postService.createPost(idea.id, {
          content: `🔑 @${callerName} ${actionDescription} @${targetLabel}.`,
          sender_type: 'system'
        });
        const refreshedPosts = await postService.getPosts(idea.id);
        setPosts(refreshedPosts);
        return;
      }

      const newPost = await postService.createPost(idea.id, postData, currentUser);
      
      let updatedPostsList = [];
      setPosts(prev => {
        const existingIdx = prev.findIndex(p => p.id === newPost.id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = newPost;
          updatedPostsList = updated;
          return updated;
        }
        updatedPostsList = [...prev, newPost];
        return updatedPostsList;
      });
      if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);

      // Smooth scroll down to user's new post
      setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Check if this post should trigger Idvy AI
      if (aiService.shouldTriggerIdvy(userMessageContent)) {
        const callerName = currentUser?.display_name || currentUser?.email?.split('@')[0] || 'friend';

        // 1. Check Global Pause
        if (aiService.isGlobalPaused()) {
          (async () => {
            await postService.createPost(idea.id, {
              content: `⏸️ **Idvy Notice**: Hey @${callerName}! Idvy is currently paused globally by platform administrators.`,
              sender_type: 'ai',
              agent_name: 'idvy'
            }, IDVY_BOT_USER);
            const refreshed = await postService.getPosts(idea.id);
            setPosts(refreshed);
          })();
          return;
        }

        // 2. Check Admin User Ban
        if (aiService.isUserAIBanned(currentUser?.id)) {
          (async () => {
            await postService.createPost(idea.id, {
              content: `🚫 **AI Access Restricted**: Hey @${callerName}, your AI access has been restricted by an administrator.`,
              sender_type: 'ai',
              agent_name: 'idvy'
            }, IDVY_BOT_USER);
            const refreshed = await postService.getPosts(idea.id);
            setPosts(refreshed);
          })();
          return;
        }

        // 3. Check Idea-level Pause
        if (isIdvyPaused) {
          (async () => {
            await postService.createPost(idea.id, {
              content: `⏸️ **Idvy Notice**: Hey @${callerName}! Idvy is currently paused in this idea space. ${isPausedByAdmin ? 'It was paused by a platform administrator.' : 'The idea owner can resume Idvy from Idea Settings.'}`,
              sender_type: 'ai',
              agent_name: 'idvy'
            }, IDVY_BOT_USER);
            const refreshed = await postService.getPosts(idea.id);
            setPosts(refreshed);
          })();
          return;
        }

        // 4. Check Member AI Permission for Tagging in main discussion
        if (!canTagAI && !isOwner && !isAdmin) {
          setNoticeModalConfig({
            isOpen: true,
            badge: 'lock',
            title: 'Tagging Access Reserved',
            message: `Hey @${callerName}! Mentioning @Idvy in the main discussion requires Tagging access.\n\nThe idea owner (@${idea.owner_name || 'Owner'}) can grant you Tagging (@Idvy) access from Idea Settings -> AI Permissions.`
          });
          return;
        }

        setIsIdvyThinking(true);
        const parsed = aiService.parseInput(userMessageContent);

        if (parsed.command === 'websearch' || parsed.command === 'research') {
          setIdvyStatus(`Idvy is looking up live research for @${callerName}...`);
        } else if (parsed.command === 'validate') {
          setIdvyStatus(`Idvy is thinking through this proposal with @${callerName}...`);
        } else if (parsed.command === 'summarize') {
          setIdvyStatus(parsed.targetMember ? `Idvy is highlighting @${parsed.targetMember}'s thoughts...` : `Idvy is putting together a summary for @${callerName}...`);
        } else if (parsed.command === 'coreidea') {
          setIdvyStatus(`Idvy is distilling the core vision with @${callerName}...`);
        } else if (parsed.command === 'improve') {
          setIdvyStatus(`Idvy is cooking up creative ideas for @${callerName}...`);
        } else {
          setIdvyStatus(`Idvy is typing a response for @${callerName}...`);
        }

        setTimeout(() => {
          timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 120);

        const tempStreamingId = `streaming-ai-${Date.now()}`;
        let hasAppendedTemp = false;

        (async () => {
          try {
            const aiResponse = await aiService.queryIdvy({
              ideaId: idea.id,
              userPrompt: userMessageContent,
              idea,
              members,
              posts: updatedPostsList.length > 0 ? updatedPostsList : posts,
              callerUser: currentUser,
              onChunk: (delta, accumulated, meta) => {
                // Once the first token arrives, hide the waiting indicator
                setIsIdvyThinking(false);

                if (!hasAppendedTemp) {
                  hasAppendedTemp = true;
                  setPosts(prev => [
                    ...prev,
                    {
                      id: tempStreamingId,
                      content: accumulated,
                      sender_type: 'ai',
                      agent_name: 'idvy',
                      created_at: 'Typing...',
                      user: {
                        id: IDVY_BOT_USER.id,
                        display_name: 'Idvy',
                        email: 'idvy@ideate.app',
                        avatar_url: '/avatars/idvy-avatar.avif'
                      },
                      ai_metadata: {
                        sources: meta?.sources || [],
                        command: meta?.command || parsed.command,
                        targetMember: parsed.targetMember,
                        is_streaming: true
                      }
                    }
                  ]);
                } else {
                  setPosts(prev => prev.map(p => p.id === tempStreamingId ? {
                    ...p,
                    content: accumulated,
                    ai_metadata: {
                      ...p.ai_metadata,
                      sources: meta?.sources || p.ai_metadata?.sources || [],
                      is_streaming: true
                    }
                  } : p));
                }

                timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
            });

            // Insert completed Idvy message into chat thread in Supabase database
            const botPost = await postService.createPost(idea.id, {
              content: aiResponse.content,
              sender_type: 'ai',
              agent_name: 'idvy',
              ai_metadata: {
                sources: aiResponse.sources || [],
                command: aiResponse.command || parsed.command,
                targetMember: parsed.targetMember
              }
            }, IDVY_BOT_USER);

            // Replace temporary streaming post with the persisted DB post
            setPosts(prev => {
              const withoutTemp = prev.filter(p => p.id !== tempStreamingId);
              const existingIdx = withoutTemp.findIndex(p => p.id === botPost.id);
              if (existingIdx !== -1) {
                const updated = [...withoutTemp];
                updated[existingIdx] = botPost;
                return updated;
              }
              return [...withoutTemp, botPost];
            });

            if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);

            setTimeout(() => {
              timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 150);
          } catch (aiErr) {
            console.error('Idvy invocation error:', aiErr);
            // Clean up temporary streaming post on error
            setPosts(prev => prev.filter(p => p.id !== tempStreamingId));
            try {
              await postService.createPost(idea.id, {
                content: `⚠️ **Idvy Collaborator Notice**: ${aiErr.message || 'Unable to complete response. Please check AI access or verify your connection.'}`,
                sender_type: 'ai',
                agent_name: 'idvy'
              }, IDVY_BOT_USER);
            } catch (_) {}
          } finally {
            setIsIdvyThinking(false);
            setIdvyStatus('Idvy is reviewing the discussion...');
          }
        })();
      }
    } catch (err) {
      alert('Failed to post: ' + err.message);
    }
  };

  const handleDeletePost = (postId) => {
    const post = posts.find(p => p.id === postId);
    setPostToDelete(post || { id: postId });
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      await postService.deletePost(idea.id, postToDelete.id);
      setPosts(prev => prev.filter(p => p.id !== postToDelete.id));
      if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
      setPostToDelete(null);
    } catch (err) {
      alert('Failed to delete post: ' + err.message);
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleMemberAdded = (newMember) => {
    setMembers(prev => [...prev, newMember]);
    if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
    notificationService.addNotification({
      title: `Collaborator Added 👥`,
      message: `${newMember.display_name || newMember.email} joined "${idea.title}".`,
      type: 'member',
      ideaId: idea.id,
      playSound: true
    });
  };

  const handleMemberRemoved = (memberId) => {
    setMembers(prev => prev.filter(m => m.id !== memberId && m.user_id !== memberId));
    if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
  };

  // Jump and smooth highlight to a referenced post
  const handleJumpToMessage = (postId) => {
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-blue-100/60');
      setTimeout(() => el.classList.remove('bg-blue-100/60'), 1800);
    }
  };

  // Confirm and execute clearing of all user messages with reason note
  const handleConfirmClearMessages = async (reason) => {
    setIsClearingMessages(true);
    try {
      await postService.clearUserPosts(idea.id, currentUser.id, reason);
      setIsClearMessagesOpen(false);
      // Reload posts to reflect system notice immediately
      const refreshed = await postService.getPosts(idea.id);
      setPosts(refreshed);
      if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);
    } catch (err) {
      alert('Failed to clear messages: ' + err.message);
    } finally {
      setIsClearingMessages(false);
    }
  };

  const theme = getIdeaTheme(idea?.color_theme);
  const userMessagesCount = posts.filter(p => 
    (p.user_id === currentUser?.id || p.user?.email === currentUser?.email) && !p.is_system
  ).length;

  return (
    <div 
      className="flex-1 flex flex-col h-full max-h-full w-full min-h-0 overflow-hidden"
      style={{
        backgroundColor: theme.lightHex || (theme.hex + '14'),
        backgroundImage: `radial-gradient(ellipse at 50% -10%, ${theme.hex}25 0%, ${theme.hex}08 50%, transparent 80%)`
      }}
    >
      {/* ======================================================== */}
      {/* COMPACT TOP NAVIGATION BAR (~50px) - SAVES VERTICAL SPACE*/}
      {/* ======================================================== */}
      <header 
        className="h-12 sm:h-13 px-3 sm:px-6 flex items-center justify-between border-b flex-shrink-0 z-10 transition-colors shadow-2xs backdrop-blur-md"
        style={{
          backgroundColor: theme.lightHex ? `${theme.lightHex}ee` : '#ffffffcc',
          borderColor: theme.borderHex || '#e2e8f0'
        }}
      >
        {/* Left: Back + Idea Title + Theme Dot + Description popover */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-black/5 text-slate-700 font-semibold text-xs sm:text-sm transition group"
            title="Back to Ideas"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px bg-slate-300/80 flex-shrink-0"></div>

          {/* Theme Color Indicator */}
          <span 
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs" 
            style={{ backgroundColor: theme.hex }}
            title={`Theme: ${theme.name}`}
          />

          {/* Title & subtle description / info trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-xs md:max-w-md">
              {idea.title}
            </h1>

            <button
              type="button"
              onClick={() => setIsIdeaInfoOpen(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition"
              title="Idea Overview, AI Details & Diagnostics"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Members Stack + Add Member + Clear My Messages + Owner Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Members Avatar Row & Sheet Trigger */}
          <button 
            type="button"
            onClick={() => setIsMembersSheetOpen(true)}
            className="flex items-center gap-1.5 p-1 pr-2 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 transition shadow-2xs"
            title="View Collaborators"
          >
            <div className="flex -space-x-1.5 overflow-hidden">
              {members.slice(0, 3).map((m, idx) => (
                <img
                  key={m.id || idx}
                  src={m.avatar_url || getRandomAvatar(m.display_name || m.email || idx)}
                  alt={m.display_name}
                  className="inline-block h-5 w-5 rounded-full ring-1 ring-white object-cover"
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-600 font-bold">{members.length}</span>
          </button>

          {/* Off-the-Record Button (themed nicely to match other buttons) */}
          <button
            type="button"
            onClick={() => {
              if (!canUseOTR && !isOwner && !isAdmin) {
                setNoticeModalConfig({
                  isOpen: true,
                  badge: 'lock',
                  title: 'Off-Chat Access Reserved',
                  message: `Off-the-Record private AI chat is reserved for the idea owner by default.\n\nThe idea owner (@${idea.owner_name || 'Owner'}) can grant you Off-chat access from Idea Settings -> AI Permissions.`
                });
                return;
              }
              setIsPrivateSidebarOpen(prev => !prev);
            }}
            className="px-2.5 sm:px-3 py-1 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-2xs active:scale-95"
            style={
              (!canUseOTR && !isOwner && !isAdmin)
                ? { borderColor: '#e2e8f0', color: '#94a3b8', backgroundColor: 'rgba(241,245,249,0.85)' }
                : isPrivateSidebarOpen
                  ? { backgroundColor: theme.hex, borderColor: theme.hex, color: '#ffffff' }
                  : { borderColor: theme.borderHex || '#e2e8f0', color: theme.hex, backgroundColor: 'rgba(255,255,255,0.9)' }
            }
            title={(!canUseOTR && !isOwner && !isAdmin) ? "Off-the-Record is reserved for idea owner by default (ask owner to grant access)" : isPrivateSidebarOpen ? "Close Off-the-Record" : "Open Off-the-Record space"}
          >
            <EyeOff className="w-3.5 h-3.5" style={{ color: (!canUseOTR && !isOwner && !isAdmin) ? '#94a3b8' : isPrivateSidebarOpen ? '#ffffff' : theme.hex }} />
            <span className="hidden sm:inline">Off-the-Record</span>
            {!canUseOTR && !isOwner && !isAdmin && <Lock className="w-2.5 h-2.5 text-slate-400" />}
          </button>

          {/* Add / Invite Collaborator Button */}
          <button
            type="button"
            onClick={() => setIsAddMemberOpen(true)}
            className="px-2 sm:px-2.5 py-1 rounded-xl bg-white/90 hover:bg-white text-xs font-semibold border transition flex items-center gap-1 shadow-2xs"
            style={{ borderColor: theme.borderHex, color: theme.hex }}
            title="Add Collaborator"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Invite</span>
          </button>

          {/* Clear All My Messages Button (only shown if user has sent messages in this idea) */}
          {userMessagesCount > 0 && (
            <button
              type="button"
              onClick={() => setIsClearMessagesOpen(true)}
              className="px-2 sm:px-2.5 py-1 rounded-xl bg-white/90 hover:bg-rose-50 text-xs font-semibold text-rose-600 border border-rose-200/80 transition flex items-center gap-1 shadow-2xs"
              title="Clear all my messages from this idea"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden lg:inline">Clear My Posts</span>
            </button>
          )}

          {/* Mute / Unmute Idea Notifications Toggle (positioned to the left beside the Settings button) */}
          <button
            type="button"
            onClick={handleToggleMuteIdea}
            className={`p-1.5 rounded-xl border transition shadow-2xs flex items-center gap-1 text-xs font-semibold ${
              isMuted
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-white/90 hover:bg-white text-slate-600 border-slate-200/80'
            }`}
            title={isMuted ? 'Notifications muted for this idea (Click to unmute)' : 'Mute notifications for this idea'}
          >
            {isMuted ? (
              <BellOff className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Settings Menu - ONLY visible for the author of the idea and admin, and NOT to members */}
          {canManage && (
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(prev => !prev)}
                className={`p-1.5 rounded-xl transition border shadow-2xs flex items-center justify-center ${
                  isSettingsOpen 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80'
                }`}
                title="Idea Settings & Management"
              >
                <Settings className={`w-4 h-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : ''}`} />
              </button>

              {isSettingsOpen && (
                <div 
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-scale-in"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Idea Settings
                  </div>

                  {/* Copy Idea ID */}
                  <button
                    type="button"
                    onClick={() => {
                      if (idea?.id) {
                        navigator.clipboard.writeText(idea.id);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 rounded-xl transition text-left"
                    title="Copy unique Idea ID for collaborators to join"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="text-emerald-700 font-bold">Copied ID!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>Copy Idea ID</span>
                      </>
                    )}
                  </button>

                  {/* Idvy AI Permissions */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsAIAccessOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:bg-purple-50/80 rounded-xl transition text-left"
                    title="Manage Idvy AI Collaborator permissions"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    <span>AI Permissions</span>
                  </button>

                  {/* Pause / Resume Idvy Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleTogglePauseIdvy();
                    }}
                    disabled={isPausedByAdmin && !isAdmin}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-xl transition text-left ${
                      isPausedByAdmin && !isAdmin
                        ? 'text-slate-400 bg-slate-50 cursor-not-allowed opacity-60'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={isPausedByAdmin && !isAdmin ? "Paused by platform administrator (cannot resume)" : "Toggle Idvy active status"}
                  >
                    {isIdvyPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{isPausedByAdmin && !isAdmin ? 'Paused by Admin (Locked)' : 'Resume Idvy'}</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>Pause Idvy</span>
                      </>
                    )}
                  </button>

                  {/* Edit Idea */}
                  {onEditIdea && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onEditIdea(idea);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition text-left"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>Edit Idea</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 my-1"></div>

                  {/* Delete Idea */}
                  {onDeleteIdea && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onDeleteIdea(idea);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                      <span>Delete Idea</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN CHAT AREA (WITH LEFT FILTER SIDEBAR IF ACTIVE)      */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-row h-full max-h-full w-full min-h-0 overflow-hidden">
        {/* Left Side Filtered Person's Messages Panel */}
        {selectedPersonForFilter && (
          <UserMessagesSidebar
            user={selectedPersonForFilter}
            posts={posts}
            onClose={() => setSelectedPersonForFilter(null)}
            onSelectMessage={handleJumpToMessage}
          />
        )}

        {/* Main Chat Timeline & Composer Area (visible always, or side-by-side with Off-the-Record) */}
        <div className={`flex-1 flex flex-col h-full max-h-full max-w-4xl mx-auto w-full min-h-0 overflow-hidden px-2 sm:px-4 ${isPrivateSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Global Pause Idvy Alert Banner if paused globally */}
          {aiService.isGlobalPaused() && (
            <div className="my-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2 shadow-2xs flex-shrink-0 animate-fade-in">
              <span className="p-1 rounded-lg bg-purple-200 text-purple-800">
                <Pause className="w-3.5 h-3.5" />
              </span>
              <span>
                <strong>Idvy Global Pause:</strong> Idvy is temporarily paused platform-wide by administrators.
              </span>
            </div>
          )}

          {/* Pause Idvy Alert Banner if paused */}
          {isIdvyPaused && (
            <div className="my-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-2xs flex-shrink-0 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-amber-200/70 text-amber-800">
                  <Pause className="w-3.5 h-3.5" />
                </span>
                <span>
                  <strong>Idvy is paused.</strong> {isPausedByAdmin ? 'Paused by platform administrator.' : 'Mentions and auto-replies are paused.'}
                </span>
              </div>
              {isPausedByAdmin && !isAdmin ? (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-lg">
                  Paused by Admin (Locked)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTogglePauseIdvy(false)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs active:scale-95"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Resume</span>
                </button>
              )}
            </div>
          )}

          {/* Discussion Timeline Feed (Scrollable messages) */}
          <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-2 sm:space-y-3 overscroll-contain">
            {loading ? (
              <LoadingScreen message="Loading discussion..." fullScreen={false} size="default" />
            ) : posts.length > 0 ? (
              <>
                {posts.map((post) => (
                  <div key={post.id} id={`post-${post.id}`} className="transition-colors duration-500 rounded-2xl">
                    <PostItem
                      post={post}
                      members={members}
                      onDelete={handleDeletePost}
                      onReply={(p) => setReplyingTo(p)}
                      onSelectPerson={(u) => setSelectedPersonForFilter(u)}
                      onJumpToMessage={handleJumpToMessage}
                      isIdeaAuthor={isIdeaAuthor}
                      onDeleteAllIdvyPosts={handleDeleteAllIdvyPosts}
                      canUseOTR={canUseOTR || isOwner || isAdmin}
                      onAskIdvyInOTR={(canUseOTR || isOwner || isAdmin) ? handleAskIdvyInOTR : null}
                    />
                  </div>
                ))}
                {isIdvyThinking && (
                  <IdvyTypingIndicator status={idvyStatus} />
                )}
                <div ref={timelineEndRef} />
              </>
            ) : (
              <div className="bg-white/80 border border-dashed border-slate-200/90 rounded-2xl p-8 text-center max-w-sm mx-auto my-12 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No messages yet</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Type your thoughts, record a voice note, or drop reference images below to start collaborating!
                </p>
              </div>
            )}
          </div>

          {/* Compact Post Composer docked at the bottom */}
          <div className="flex-shrink-0 pt-1 pb-2">
            <PostComposer
              ideaId={idea.id}
              onPostCreated={handlePostCreated}
              theme={theme}
              members={members}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              prefillContent={composerPrefill}
              onClearPrefill={() => setComposerPrefill('')}
              hasAIAccess={hasAIAccess}
              canTagAI={canTagAI || isOwner || isAdmin}
              onBlockedAIAttempt={() => {
                setNoticeModalConfig({
                  isOpen: true,
                  badge: 'lock',
                  title: 'Tagging Access Reserved',
                  message: `Mentioning @Idvy in the main discussion requires Tagging access.\n\nThe idea owner (@${idea.owner_name || 'Owner'}) can grant you Tagging (@Idvy) access from Idea Settings -> AI Permissions.`
                });
              }}
            />
          </div>
        </div>

        {/* Embedded In-Chat Off-the-Record Space */}
        {isPrivateSidebarOpen && (
          <ErrorBoundary
            title="Off-the-Record Chat Unavailable"
            onClose={() => setIsPrivateSidebarOpen(false)}
            onReset={() => setIsPrivateSidebarOpen(false)}
          >
            <IdvyPrivateSidebar
              isOpen={isPrivateSidebarOpen}
              onClose={() => setIsPrivateSidebarOpen(false)}
              idea={idea}
              posts={posts}
              members={members}
              currentUser={currentUser}
              canUseOTR={canUseOTR || isOwner || isAdmin}
              initialPrompt={privateSidebarPrompt}
              onClearInitialPrompt={() => setPrivateSidebarPrompt('')}
              onSendToIdeaChat={async (msgText) => {
                await handlePostCreated({ content: msgText });
              }}
              onSendAsIdvyToChat={handleSendAsIdvyToChat}
              onSendToComposer={(text) => {
                setComposerPrefill(text);
              }}
              onAnswerInMainChat={handleAnswerInMainChat}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* Clear All My Messages Modal */}
      <ClearMessagesModal
        isOpen={isClearMessagesOpen}
        onClose={() => setIsClearMessagesOpen(false)}
        onConfirm={handleConfirmClearMessages}
        isClearing={isClearingMessages}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        ideaId={idea.id}
        onMemberAdded={handleMemberAdded}
      />

      {/* Members Sheet */}
      <MembersSheet
        isOpen={isMembersSheetOpen}
        onClose={() => setIsMembersSheetOpen(false)}
        idea={idea}
        members={members}
        onOpenAddMember={() => setIsAddMemberOpen(true)}
        onMemberRemoved={handleMemberRemoved}
      />

      {/* AI Access Manager Modal */}
      <AIAccessManagerModal
        isOpen={isAIAccessOpen}
        onClose={() => setIsAIAccessOpen(false)}
        idea={idea}
        members={members}
        currentUser={currentUser}
      />

      {/* Custom Delete Post Confirmation Modal */}
      <DeletePostModal
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        post={postToDelete}
        onConfirm={handleConfirmDeletePost}
        isDeleting={isDeletingPost}
      />

      {/* Idea Overview & Diagnostics Info Modal */}
      <IdeaInfoModal
        isOpen={isIdeaInfoOpen}
        onClose={() => setIsIdeaInfoOpen(false)}
        idea={idea}
        members={members}
        postsCount={posts.length}
        isIdvyPaused={isIdvyPaused}
      />

      {/* Styled In-App Notice & Access Modal */}
      <NoticeModal
        isOpen={noticeModalConfig.isOpen}
        onClose={() => setNoticeModalConfig(prev => ({ ...prev, isOpen: false }))}
        badge={noticeModalConfig.badge}
        title={noticeModalConfig.title}
        message={noticeModalConfig.message}
      />
    </div>
  );
}
