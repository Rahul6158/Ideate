import React, { useState, useMemo } from 'react';
import { ChevronDown, Plus, Sparkles, Filter, Compass, Check, X, UserCheck } from 'lucide-react';
import IdeaCard from '../components/ideas/IdeaCard';
import { useAuth } from '../context/AuthContext';
import { memberService } from '../services/memberService';
import { getIdeaTheme } from '../data/themePalettes';

export default function Dashboard({ 
  ideas = [], 
  onSelectIdea, 
  onOpenNewIdea,
  onOpenJoinIdea, 
  onDeleteIdea,
  onEditIdea,
  searchQuery = '',
  onRefreshIdeas
}) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'my' | 'shared'
  const [sortBy, setSortBy] = useState('updated'); // 'updated' | 'newest' | 'posts' | 'title'
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const [processingInviteId, setProcessingInviteId] = useState(null);
  const [resolvedInviteIds, setResolvedInviteIds] = useState(() => new Set());
  const [acceptedInviteIds, setAcceptedInviteIds] = useState(() => new Set());

  // Pending invitations for current user (instantly excludes optimistically resolved invites)
  const pendingInvites = useMemo(() => {
    return ideas.filter(i => i.is_pending_invite && !resolvedInviteIds.has(i.id));
  }, [ideas, resolvedInviteIds]);

  const handleAcceptInvite = async (ideaId) => {
    if (!currentUser?.id || processingInviteId === ideaId) return;
    setProcessingInviteId(ideaId);

    // Optimistically hide the invite banner immediately and show the idea in the feed
    setResolvedInviteIds(prev => {
      const next = new Set(prev);
      next.add(ideaId);
      return next;
    });
    setAcceptedInviteIds(prev => {
      const next = new Set(prev);
      next.add(ideaId);
      return next;
    });

    try {
      await memberService.acceptInvite(ideaId, currentUser.id);
      if (onRefreshIdeas) await onRefreshIdeas();
    } catch (err) {
      // Rollback optimistic state if failed
      setResolvedInviteIds(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
      setAcceptedInviteIds(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
      alert('Failed to accept invitation: ' + err.message);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleRejectInvite = async (ideaId) => {
    if (!currentUser?.id || processingInviteId === ideaId) return;
    setProcessingInviteId(ideaId);

    // Optimistically hide the invite banner immediately
    setResolvedInviteIds(prev => {
      const next = new Set(prev);
      next.add(ideaId);
      return next;
    });

    try {
      await memberService.rejectInvite(ideaId, currentUser.id);
      if (onRefreshIdeas) await onRefreshIdeas();
    } catch (err) {
      // Rollback optimistic state if failed
      setResolvedInviteIds(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
      alert('Failed to decline invitation: ' + err.message);
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      const isOptimisticallyAccepted = acceptedInviteIds.has(idea.id);
      const isOptimisticallyDeclined = resolvedInviteIds.has(idea.id) && !isOptimisticallyAccepted;

      if (isOptimisticallyDeclined) return false;

      // Pending invites are shown in the dedicated banner above, not regular card feed
      if (idea.is_pending_invite && !isOptimisticallyAccepted) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = idea.title?.toLowerCase().includes(q);
        const matchesDesc = idea.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Tab filter
      const isOwner = idea.owner_id === currentUser?.id;
      const isMember = isOptimisticallyAccepted || idea.is_shared || idea.idea_members?.some(m => 
        m.user_id === currentUser?.id && m.role !== 'pending_invite' && m.role !== 'pending_join'
      );

      if (filterTab === 'my') return isOwner;
      if (filterTab === 'shared') return isMember && !isOwner;
      return isOwner || isMember || isAdmin;
    }).sort((a, b) => {
      if (sortBy === 'updated') {
        return (b.updated_timestamp || 0) - (a.updated_timestamp || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'posts') {
        return (b.posts_count || 0) - (a.posts_count || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [ideas, filterTab, sortBy, searchQuery, currentUser]);

  const sortLabels = {
    updated: 'Last Updated',
    newest: 'Newest First',
    posts: 'Most Active',
    title: 'Alphabetical'
  };

  return (
    <div className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      {/* Greeting Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{greeting}, {currentUser?.display_name || 'there'}</span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1 font-normal">
            Here are your ideas and discussions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenJoinIdea && (
            <button
              type="button"
              onClick={onOpenJoinIdea}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200/90 shadow-2xs transition flex items-center gap-1.5"
            >
              <Compass className="w-4 h-4 text-blue-600" />
              <span>Join with ID</span>
            </button>
          )}

          {!isAdmin && onOpenNewIdea && (
            <button
              type="button"
              onClick={onOpenNewIdea}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-sm shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Idea</span>
            </button>
          )}
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Pending Invitations ({pendingInvites.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvites.map(inv => {
              const theme = getIdeaTheme(inv.color_theme);
              return (
                <div 
                  key={inv.id} 
                  className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: theme.hex }} />
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{inv.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        Invited by: {inv.owner?.display_name || inv.owner?.email || 'Creator'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(inv.id)}
                      disabled={processingInviteId === inv.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectInvite(inv.id)}
                      disabled={processingInviteId === inv.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 active:scale-95 text-xs font-semibold transition border border-slate-200/80"
                    >
                      <X className="w-3 h-3" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar & Sort matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-7">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
              filterTab === 'all'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterTab('my')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
              filterTab === 'my'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            My Ideas
          </button>
          <button
            onClick={() => setFilterTab('shared')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
              filterTab === 'shared'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            Shared With Me
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="relative self-end sm:self-auto">
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <span>{sortLabels[sortBy]}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isSortOpen && (
            <div 
              className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 p-1.5 z-20 animate-fade-in"
              onMouseLeave={() => setIsSortOpen(false)}
            >
              {Object.entries(sortLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setIsSortOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${
                    sortBy === key 
                      ? 'bg-blue-50 text-blue-600 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Idea Cards Grid (3 Columns on Desktop) */}
      {filteredIdeas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onSelect={onSelectIdea}
              onDelete={onDeleteIdea}
              onEdit={onEditIdea}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 sm:p-14 text-center max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {searchQuery ? 'No ideas match your search' : "You don't have any ideas here yet"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {searchQuery
              ? 'Try adjusting your search terms or filter.'
              : 'Create your first idea space to start capturing thoughts and inviting collaborators.'}
          </p>
          {!isAdmin && (
            <button
              onClick={onOpenNewIdea}
              className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-500/20 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Idea</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
