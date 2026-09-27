import React from 'react';
import { X, MessageSquare, ArrowRight, CornerDownRight } from 'lucide-react';
import { getRandomAvatar } from '../../data/avatars';
import AudioPlayer from './AudioPlayer';

export default function UserMessagesSidebar({ 
  user, 
  posts = [], 
  onClose, 
  onSelectMessage 
}) {
  if (!user) return null;

  const userPosts = posts.filter(p => 
    (p.user_id && p.user_id === user.id) || 
    (p.user?.email && p.user.email === user.email)
  );

  return (
    <div className="w-80 sm:w-96 flex-shrink-0 h-full bg-white border-r border-slate-200/90 flex flex-col shadow-lg z-20 animate-slide-right overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user.avatar_url || getRandomAvatar(user.email || user.display_name)}
            alt={user.display_name || 'Member'}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-300 shadow-sm flex-shrink-0 bg-slate-100"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {user.display_name || 'Collaborator'}
            </h4>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          title="Close filter"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats ribbon */}
      <div className="px-4 py-2 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between text-xs">
        <span className="font-semibold text-purple-900">
          Messages by this person
        </span>
        <span className="font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800 text-[11px]">
          {userPosts.length} posts
        </span>
      </div>

      {/* Stacked messages list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {userPosts.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>No messages sent by this member yet.</p>
          </div>
        ) : (
          userPosts.map((post, idx) => {
            const hasAudio = post.attachments?.some(a => a.file_type === 'audio');
            const hasImages = post.attachments?.some(a => a.file_type === 'image');
            const images = (post.attachments || []).filter(a => a.file_type === 'image');
            const audios = (post.attachments || []).filter(a => a.file_type === 'audio');

            return (
              <div
                key={post.id || idx}
                onClick={() => onSelectMessage && onSelectMessage(post.id)}
                className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-purple-300 hover:shadow-sm transition cursor-pointer group"
                title="Click to locate in main discussion"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-mono">{post.created_at}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-purple-600 font-bold flex items-center gap-0.5 transition">
                    <span>View</span>
                    <CornerDownRight className="w-3 h-3" />
                  </span>
                </div>

                {/* Quoted reply indicator if applicable */}
                {post.reply_to && (
                  <div className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg mb-1.5 truncate border border-slate-100">
                    ↩ Replying to <span className="font-semibold text-slate-600">{post.reply_to.user_name}</span>
                  </div>
                )}

                {/* Audio players if any */}
                {audios.map((att, i) => (
                  <div key={i} className="mb-2" onClick={(e) => e.stopPropagation()}>
                    <AudioPlayer src={att.storage_path} duration={att.duration_seconds || 30} />
                  </div>
                ))}

                {/* Text Content */}
                {post.content && (
                  <p className="text-xs text-slate-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}

                {/* Small thumbnail preview */}
                {images.length > 0 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto">
                    {images.slice(0, 3).map((img, i) => (
                      <img
                        key={i}
                        src={img.storage_path}
                        alt="attachment"
                        className="w-12 h-12 rounded-lg object-cover ring-1 ring-slate-200 flex-shrink-0"
                      />
                    ))}
                    {images.length > 3 && (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        +{images.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
