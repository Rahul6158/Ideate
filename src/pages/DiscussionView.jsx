import React, { useState, useEffect, useRef } from 'react';
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
  BellOff
} from 'lucide-react';
import PostItem from '../components/posts/PostItem';
import PostComposer from '../components/posts/PostComposer';
import DeletePostModal from '../components/posts/DeletePostModal';
import ClearMessagesModal from '../components/posts/ClearMessagesModal';
import UserMessagesSidebar from '../components/posts/UserMessagesSidebar';
import AddMemberModal from '../components/ideas/AddMemberModal';
import MembersSheet from '../components/ideas/MembersSheet';
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

  // Handle post created with deduplication
  const handlePostCreated = async (postData) => {
    try {
      const newPost = await postService.createPost(idea.id, postData, currentUser);
      setPosts(prev => {
        const existingIdx = prev.findIndex(p => p.id === newPost.id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = newPost;
          return updated;
        }
        return [...prev, newPost];
      });
      if (onUpdateIdeaStats) onUpdateIdeaStats(idea.id);

      // Smooth scroll down to new post
      setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
  const isOwner = idea?.owner_id === currentUser?.id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const canManage = isOwner || isAdmin;
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

          {/* Title & subtle description */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-xs md:max-w-md">
              {idea.title}
            </h1>

            {idea.description && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDescriptionTooltip(prev => !prev)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-black/5 transition"
                  title="View description"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showDescriptionTooltip && (
                  <div 
                    className="absolute left-0 top-full mt-1 w-64 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-50 animate-fade-in leading-relaxed"
                    onClick={() => setShowDescriptionTooltip(false)}
                  >
                    <p className="font-semibold text-slate-200 mb-0.5">Idea Summary</p>
                    <p className="text-slate-300 font-normal">{idea.description}</p>
                  </div>
                )}
              </div>
            )}
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

          {/* Mute / Unmute Idea Notifications Toggle */}
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

        {/* Main Chat Timeline & Composer Area */}
        <div className="flex-1 flex flex-col h-full max-h-full max-w-4xl mx-auto w-full min-h-0 overflow-hidden px-2 sm:px-4">
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
                    />
                  </div>
                ))}
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
            />
          </div>
        </div>
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

      {/* Custom Delete Post Confirmation Modal */}
      <DeletePostModal
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        post={postToDelete}
        onConfirm={handleConfirmDeletePost}
        isDeleting={isDeletingPost}
      />
    </div>
  );
}
