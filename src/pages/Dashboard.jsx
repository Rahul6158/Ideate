import React, { useState, useMemo } from 'react';
import { ChevronDown, Plus, Sparkles, Filter } from 'lucide-react';
import IdeaCard from '../components/ideas/IdeaCard';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ 
  ideas = [], 
  onSelectIdea, 
  onOpenNewIdea, 
  onDeleteIdea,
  onEditIdea,
  searchQuery = ''
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

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = idea.title?.toLowerCase().includes(q);
        const matchesDesc = idea.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Tab filter
      const isOwner = idea.owner_id === currentUser?.id;
      const isMember = idea.is_shared || idea.idea_members?.some(m => m.user_id === currentUser?.id);

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
      {/* Greeting Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span>{greeting}, {currentUser?.display_name || 'Rahul'}</span>
          <span className="text-2xl">👋</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1 font-normal">
          Here are your ideas and discussions
        </p>
      </div>

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
