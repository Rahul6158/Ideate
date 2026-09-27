import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { getRandomAvatar } from '../../data/avatars';

export default function DeletePostModal({ isOpen, onClose, post, onConfirm, isDeleting = false }) {
  if (!isOpen || !post) return null;

  const hasAudio = post.attachments?.some(a => a.file_type === 'audio');
  const hasImage = post.attachments?.some(a => a.file_type === 'image');
  const snippet = post.content 
    ? post.content 
    : hasAudio 
      ? 'Voice message' 
      : hasImage 
        ? 'Image attachment' 
        : 'Discussion item';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Message?</h3>
              <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post Snippet Preview */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <img 
              src={post.user?.avatar_url || getRandomAvatar(post.user?.display_name || 'User')} 
              alt={post.user?.display_name || 'Author'}
              className="w-5 h-5 rounded-full object-cover" 
            />
            <span className="text-xs font-semibold text-slate-800">
              {post.user?.display_name || 'You'}
            </span>
            <span className="text-[11px] text-slate-400">
              • {post.created_at || 'Recent'}
            </span>
          </div>
          <p className="text-xs text-slate-600 italic line-clamp-2 pl-7 border-l-2 border-slate-200">
            "{snippet}"
          </p>
        </div>

        {/* Warning text */}
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Are you sure you want to permanently delete this post from the discussion timeline?
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-sm shadow-rose-500/20 transition flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Delete Post</span>
          </button>
        </div>
      </div>
    </div>
  );
}
