import React, { useState } from 'react';
import { Users, MessageSquare, MoreVertical, Trash2, Edit3, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getIdeaTheme } from '../../data/themePalettes';

import { getRandomAvatar } from '../../data/avatars';

export default function IdeaCard({ idea, onSelect, onDelete, onEdit }) {
  const { currentUser } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const isOwner = idea.owner_id === currentUser?.id;
  const canManage = isOwner || isAdmin;
  const theme = getIdeaTheme(idea.color_theme);

  return (
    <div 
      onClick={() => onSelect(idea)}
      className="group relative rounded-2xl overflow-hidden shadow-card hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1 min-h-[240px] sm:min-h-[255px] border border-slate-200/60"
    >
      {/* Background Cover Image with slight blur & smooth zoom on hover */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900 pointer-events-none">
        {idea.cover_url ? (
          <img 
            src={idea.cover_url} 
            alt={idea.title} 
            className="w-full h-full object-cover blur-[2px] scale-105 group-hover:scale-112 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center font-black text-7xl opacity-25"
            style={{ backgroundColor: theme.hex, color: '#ffffff' }}
          >
            {idea.title ? idea.title.charAt(0) : 'I'}
          </div>
        )}

        {/* Ambient Dark Gradient Scrim to ensure crisp legibility for all text */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/40" />

        {/* Top Accent Strip with Theme Color */}
        <div 
          className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-300 group-hover:h-2"
          style={{ backgroundColor: theme.hex }}
        />
      </div>

      {/* Card Content Overlay (Text ON the image) */}
      <div className="relative z-10 p-4 sm:p-5 flex-1 flex flex-col justify-between h-full">
        {/* Top Row: Theme Pill, Creator Badge & Options Menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span 
              className="text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm bg-black/40 backdrop-blur-md flex items-center gap-1.5 border border-white/20 text-white"
            >
              <span 
                className="w-2 h-2 rounded-full shadow-xs" 
                style={{ backgroundColor: theme.hex }}
              />
              <span className="tracking-wide">{theme.name.split(' ')[0]}</span>
            </span>

            {/* Creator Badge */}
            {(idea.owner?.display_name || idea.owner_name) && (
              <span 
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm bg-black/50 backdrop-blur-md flex items-center gap-1.5 border border-white/20 text-white"
                title={`Created by: ${idea.owner?.display_name || idea.owner_name} (${idea.owner?.email || idea.owner_email || ''})`}
              >
                <img 
                  src={idea.owner?.avatar_url || idea.owner_avatar || getRandomAvatar(idea.owner?.email || idea.owner?.display_name || 'Creator')} 
                  alt="Creator"
                  className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white/40"
                />
                <span className="truncate max-w-[85px] sm:max-w-[110px]">
                  {isOwner ? 'You' : (idea.owner?.display_name || idea.owner_name)}
                </span>
              </span>
            )}
          </div>

          {/* 3-dots Menu Button */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md border border-white/20 shadow-sm flex items-center justify-center transition"
              title="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-1.5 w-40 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-200/80 p-1 z-30 animate-fade-in"
                onMouseLeave={() => setShowMenu(false)}
              >
                {canManage && onEdit && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(idea);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit idea</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigator.clipboard.writeText(window.location.href);
                    alert('Idea link copied to clipboard!');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share link</span>
                </button>

                {canManage && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(idea);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete idea</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center / Bottom: Title & Description ON the image */}
        <div className="mt-auto pt-6">
          <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight line-clamp-2 leading-snug drop-shadow-sm group-hover:text-white transition-colors">
            {idea.title}
          </h3>
          <p className="text-xs sm:text-[13px] text-white/80 font-normal mt-1.5 line-clamp-2 leading-relaxed drop-shadow-xs min-h-[36px]">
            {idea.description || 'Private collaborative discussion space.'}
          </p>

          {/* Footer Metrics */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/75 font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/70" />
                <span>{idea.members_count || 1} {idea.members_count === 1 ? 'member' : 'members'}</span>
              </span>
              <span className="text-white/30">•</span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-white/70" />
                <span>{idea.posts_count || 0} {idea.posts_count === 1 ? 'post' : 'posts'}</span>
              </span>
            </div>

            <div className="text-[11px] text-white/60 font-normal">
              {idea.updated_at || 'Updated recently'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
