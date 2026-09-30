import React, { useState, useEffect } from 'react';
import { 
  MoreHorizontal, 
  Trash2, 
  Download, 
  ThumbsUp, 
  Maximize2, 
  ExternalLink, 
  X,
  FileText,
  CornerUpLeft,
  Smile,
  Plus,
  Shield,
  Info,
  Copy,
  Check,
  Zap,
  Sparkles,
  EyeOff,
  Quote
} from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import IdvyMessage from '../ai/IdvyMessage';
import { useAuth } from '../../context/AuthContext';
import { getRandomAvatar } from '../../data/avatars';
import { postService } from '../../services/postService';
import { PRESET_REACTIONS, EXTENDED_EMOJIS } from '../../data/reactions';
import { stripMarkdown } from '../../utils/textUtils';

export default function PostItem({ 
  post, 
  members = [],
  onDelete, 
  onReply, 
  onSelectPerson,
  onJumpToMessage,
  isIdeaAuthor = false,
  onDeleteAllIdvyPosts,
  onAskIdvyInOTR,
  canUseOTR = false
}) {
  const { currentUser } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [reactions, setReactions] = useState(post.reactions || []);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showExtendedEmojis, setShowExtendedEmojis] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [activeViewerImage, setActiveViewerImage] = useState(null);
  const [activeReactorsModal, setActiveReactorsModal] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const handleCopyMessage = () => {
    if (!post.content) return;
    navigator.clipboard.writeText(post.content);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  // Sync reactions when prop updates from realtime / refetch
  useEffect(() => {
    setReactions(post.reactions || []);
  }, [post.reactions]);

  const isAuthor = currentUser?.id === post.user_id || currentUser?.email === post.user?.email;

  // Deduplicate attachments
  const rawAttachments = post.attachments || [];
  const uniqueAttachments = rawAttachments.filter((att, idx, arr) => 
    arr.findIndex(a => (a.id && a.id === att.id) || (a.storage_path && a.storage_path === att.storage_path)) === idx
  );

  const audioAttachments = uniqueAttachments.filter(a => a.file_type === 'audio');
  const imageAttachments = uniqueAttachments.filter(a => a.file_type === 'image');
  const fileAttachments = uniqueAttachments.filter(a => a.file_type === 'document' || (!['audio', 'image'].includes(a.file_type)));

  const handleLike = () => {
    if (hasLiked) {
      setLikes(prev => Math.max(0, prev - 1));
      setHasLiked(false);
    } else {
      setLikes(prev => prev + 1);
      setHasLiked(true);
    }
  };

  const handleToggleReaction = async (emoji) => {
    if (!currentUser?.id) return;
    setShowReactionPicker(false);
    setShowExtendedEmojis(false);

    // Optimistic toggle
    const existingIdx = reactions.findIndex(r => r.emoji === emoji && r.user_id === currentUser.id);
    if (existingIdx !== -1) {
      setReactions(prev => prev.filter((_, i) => i !== existingIdx));
    } else {
      setReactions(prev => [...prev, { 
        emoji, 
        user_id: currentUser.id,
        user: {
          id: currentUser.id,
          display_name: currentUser.display_name,
          email: currentUser.email,
          avatar_url: currentUser.avatar_url
        }
      }]);
    }

    try {
      await postService.toggleReaction(post.id, currentUser.id, emoji);
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  const handleCustomEmojiSubmit = (e) => {
    e.preventDefault();
    if (!customEmojiInput.trim()) return;
    handleToggleReaction(customEmojiInput.trim());
    setCustomEmojiInput('');
  };

  // Group reactions by emoji and resolve reactor user details
  const reactionGroups = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasReacted: false, reactors: [] };
    acc[r.emoji].count += 1;
    if (r.user_id === currentUser?.id) acc[r.emoji].hasReacted = true;

    // Resolve reactor user details from r.user, currentUser, or members
    let reactor = r.user;
    if (!reactor) {
      if (currentUser && r.user_id === currentUser.id) {
        reactor = {
          id: currentUser.id,
          display_name: currentUser.display_name,
          email: currentUser.email,
          avatar_url: currentUser.avatar_url
        };
      } else {
        const found = (members || []).find(m => m.user_id === r.user_id || m.id === r.user_id);
        if (found) {
          reactor = {
            id: found.user_id || found.id,
            display_name: found.display_name,
            email: found.email,
            avatar_url: found.avatar_url
          };
        } else {
          reactor = {
            id: r.user_id,
            display_name: 'Collaborator',
            avatar_url: getRandomAvatar(r.user_id)
          };
        }
      }
    }
    acc[r.emoji].reactors.push(reactor);
    return acc;
  }, {});

  // If this message is from Idvy AI Collaborator
  if (post.agent_name === 'idvy' || post.sender_type === 'ai') {
    return (
      <IdvyMessage
        post={post}
        onReply={onReply}
        onJumpToMessage={onJumpToMessage}
        onDelete={onDelete}
        onDeleteAllIdvyPosts={onDeleteAllIdvyPosts}
        isIdeaAuthor={isIdeaAuthor}
        onAskIdvyInOTR={onAskIdvyInOTR}
      />
    );
  }

  // If this is a system message (e.g. cleared all messages notice)
  if (post.is_system) {
    return (
      <div className="my-3 mx-auto max-w-md p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 shadow-2xs text-center animate-fade-in">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>Notice</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed font-medium">
          {post.content}
        </p>
        <span className="text-[10px] text-amber-600/70 font-mono mt-1 block">
          {post.created_at}
        </span>
      </div>
    );
  }

  // Inline formatting for bold, italics, code, links, and @mentions
  const renderInlineMarkdown = (line) => {
    if (!line) return null;
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|@[a-zA-Z0-9_.-]+|\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
          (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
        return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs border border-slate-200">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('@')) {
        return (
          <span 
            key={i} 
            className="inline-block px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 font-bold text-xs mr-0.5 shadow-2xs"
          >
            {part.trim()}
          </span>
        );
      }
      if (part.startsWith('[') && part.includes('](')) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <a 
              key={i} 
              href={match[2]} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5 font-medium"
            >
              {match[1]}
              <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>
          );
        }
      }
      return part.replace(/\*\*/g, '');
    });
  };

  // Structured multi-line markdown formatter for posts
  const renderContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    const hasBlockTokens = lines.some(l => 
      l.trim().startsWith('```') || 
      l.trim().startsWith('### ') || 
      l.trim().startsWith('## ') || 
      l.trim().startsWith('# ') || 
      l.trim().startsWith('>') || 
      l.trim().startsWith('- ') || 
      l.trim().startsWith('* ') || 
      /^\d+\.\s+/.test(l.trim())
    );

    if (!hasBlockTokens && lines.length <= 1) {
      return renderInlineMarkdown(text);
    }

    const elements = [];
    let inCodeBlock = false;
    let codeLines = [];

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-${idx}`} className="my-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
              <pre>{codeLines.join('\n')}</pre>
            </div>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Blockquotes
      if (line.trim().startsWith('>')) {
        const quoteText = line.trim().replace(/^>\s*/, '');
        elements.push(
          <div key={idx} className="my-1.5 pl-3 py-1 border-l-3 border-blue-400 bg-blue-50/50 rounded-r-xl text-xs sm:text-sm text-blue-950 italic flex items-start gap-1.5">
            <Quote className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{renderInlineMarkdown(quoteText)}</div>
          </div>
        );
        return;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={idx} className="text-xs sm:text-sm font-bold text-slate-900 mt-2 mb-1">
            {renderInlineMarkdown(line.replace('### ', ''))}
          </h4>
        );
        return;
      }
      if (line.startsWith('## ') || line.startsWith('# ')) {
        elements.push(
          <h3 key={idx} className="text-sm sm:text-base font-bold text-slate-900 mt-2.5 mb-1">
            {renderInlineMarkdown(line.replace(/^#+\s*/, ''))}
          </h3>
        );
        return;
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().replace(/^[-*]\s+/, '');
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-0.5 pl-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
            <span className="text-blue-500 font-bold select-none">•</span>
            <span className="flex-1">{renderInlineMarkdown(bulletText)}</span>
          </div>
        );
        return;
      }

      // Numbered items
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-0.5 pl-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
            <span className="font-bold text-blue-600 min-w-4 text-right text-xs mt-0.5">{numMatch[1]}.</span>
            <span className="flex-1">{renderInlineMarkdown(numMatch[2])}</span>
          </div>
        );
        return;
      }

      // Empty line spacer
      if (!line.trim()) {
        elements.push(<div key={idx} className="h-1.5" />);
        return;
      }

      // Regular line
      elements.push(
        <div key={idx} className="text-xs sm:text-sm text-slate-800 leading-relaxed">
          {renderInlineMarkdown(line)}
        </div>
      );
    });

    if (inCodeBlock && codeLines.length > 0) {
      elements.push(
        <div key="code-end" className="my-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
          <pre>{codeLines.join('\n')}</pre>
        </div>
      );
    }

    return elements;
  };

  return (
    <>
      <div className="group relative flex items-start gap-3 sm:gap-3.5 p-3 sm:p-3.5 rounded-2xl hover:bg-white/80 border border-transparent hover:border-slate-100 hover:shadow-2xs transition-all duration-200">
        {/* Avatar - Click to filter person's messages on the left */}
        <div 
          onClick={() => onSelectPerson && onSelectPerson(post.user || { id: post.user_id, display_name: 'Member' })}
          className="relative flex-shrink-0 cursor-pointer group/avatar"
          title="Click to view all messages by this person"
        >
          <img
            src={post.user?.avatar_url || getRandomAvatar(post.user?.email || post.user?.display_name || 'User')}
            alt={post.user?.display_name || 'Author'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-white shadow-2xs group-hover/avatar:ring-blue-300 transition-all group-hover/avatar:scale-105 bg-slate-100"
          />
        </div>

        {/* Main post body */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              onClick={() => onSelectPerson && onSelectPerson(post.user || { id: post.user_id, display_name: 'Member' })}
              className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight cursor-pointer hover:text-blue-600 transition"
              title="Click to view all messages by this person"
            >
              {post.user?.display_name || 'Member'}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {post.created_at}
            </span>
          </div>

          {/* Quoted Replying-To Banner */}
          {post.reply_to && (
            <div 
              onClick={() => onJumpToMessage && onJumpToMessage(post.reply_to.id)}
              className="mb-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 border-l-3 border-blue-500 text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
              title="Click to jump to referenced message"
            >
              <CornerUpLeft className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="font-bold text-slate-800">
                Replying to {post.reply_to.user_name || 'Member'}:
              </span>
              <span className="text-slate-500 truncate italic">
                "{stripMarkdown(post.reply_to.content || 'Attached file')}"
              </span>
            </div>
          )}

          {/* Audio player if attached */}
          {audioAttachments.map((att, i) => (
            <div key={`audio-${i}`} className="my-2">
              <AudioPlayer src={att.storage_path} duration={att.duration_seconds || 42} />
            </div>
          ))}

          {/* Text content with @mentions highlighting or Slash Command Card */}
          {post.content && (() => {
            const isSlashCommand = post.content.trim().startsWith('/');
            if (isSlashCommand) {
              const match = post.content.trim().match(/^(\/[a-zA-Z0-9._]+)(?:\s+([\s\S]*))?$/);
              const commandWord = match ? match[1] : post.content.trim().split(/\s+/)[0];
              const commandPrompt = match ? (match[2] || '') : post.content.trim().slice(commandWord.length).trim();

              return (
                <div className="my-1.5 p-3 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-purple-50/90 border border-purple-200/90 shadow-2xs max-w-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded-lg bg-purple-600 text-white shadow-2xs">
                      <Zap className="w-3 h-3 fill-current" />
                    </div>
                    <span className="font-mono text-xs font-black tracking-tight text-purple-900 bg-purple-200/70 px-2 py-0.5 rounded-lg border border-purple-300/60 shadow-2xs">
                      {commandWord}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600/80">
                      Slash Command
                    </span>
                  </div>
                  {commandPrompt && (
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words font-medium pl-1 mt-1.5 space-y-1">
                      {renderContent(commandPrompt)}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words space-y-1">
                {renderContent(post.content)}
              </div>
            );
          })()}

          {/* Compact Grid View for Images */}
          {imageAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 my-2">
              {imageAttachments.map((att, i) => (
                <div
                  key={`img-${i}`}
                  onClick={() => setActiveViewerImage(att)}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200/80 shadow-2xs hover:shadow-md cursor-pointer hover:scale-105 transition-all relative group bg-slate-100 flex-shrink-0"
                  title="Click to view full size"
                >
                  <img
                    src={att.storage_path}
                    alt={att.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* File attachments */}
          {fileAttachments.map((att, i) => (
            <div key={`file-${i}`} className="my-2 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 max-w-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-[10px] uppercase">
                  {att.file_name?.split('.').pop() || 'FILE'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-800 truncate">{att.file_name}</div>
                  <div className="text-[10px] text-slate-400">
                    {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : 'Document'}
                  </div>
                </div>
              </div>
              <a
                href={att.storage_path}
                download={att.file_name}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}

          {/* ======================================================== */}
          {/* LIKES & EMOJI REACTIONS ROW                              */}
          {/* ======================================================== */}
          <div className="flex items-center gap-2 mt-2 flex-wrap relative">
            {/* Separate "Like" (ThumbsUp) Button */}
            <button 
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg transition border ${
                hasLiked 
                  ? 'text-blue-600 bg-blue-50 border-blue-200 font-semibold' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-transparent'
              }`}
              title="Like this post"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {likes > 0 && <span className="text-[11px] font-bold">{likes}</span>}
            </button>

            {/* Rendered Reaction Badges with Avatars & Who Reacted Details */}
            {Object.entries(reactionGroups).map(([emoji, info]) => {
              const preset = PRESET_REACTIONS.find(p => p.emoji === emoji);
              const label = preset ? preset.label : 'reaction';

              return (
                <div key={emoji} className="relative group/badge inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => handleToggleReaction(emoji)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border shadow-2xs hover:scale-105 active:scale-95 ${
                      info.hasReacted 
                        ? 'bg-blue-50/90 text-blue-700 border-blue-300 ring-1 ring-blue-200' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title={`${label} • Click to ${info.hasReacted ? 'remove reaction' : 'react'}`}
                  >
                    <span className="text-sm leading-none">{emoji}</span>
                    <span className="text-[11px] font-bold">{info.count}</span>

                    {/* Miniature Avatar Stack - Click to open full details */}
                    <div 
                      className="flex -space-x-1 ml-0.5 items-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReactorsModal({ emoji, label, info });
                      }}
                      title="See who reacted"
                    >
                      {info.reactors.slice(0, 3).map((u, i) => (
                        <img
                          key={u.id || i}
                          src={u.avatar_url || getRandomAvatar(u.email || u.display_name || i)}
                          alt={u.display_name || 'Member'}
                          className="w-4 h-4 rounded-full object-cover ring-1 ring-white"
                        />
                      ))}
                    </div>
                  </button>

                  {/* Desktop Hover Tooltip showing WHO reacted */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/badge:flex flex-col items-center z-50 pointer-events-none animate-fade-in min-w-[140px] max-w-[220px]">
                    <div className="w-full bg-slate-900/95 backdrop-blur-md text-white text-[11px] py-2 px-3 rounded-xl shadow-2xl border border-white/10 flex flex-col gap-1.5">
                      <div className="font-semibold text-slate-200 border-b border-white/10 pb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <span className="text-sm">{emoji}</span>
                          <span className="capitalize">{label}</span>
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">({info.count})</span>
                      </div>
                      <div className="flex flex-col gap-1.5 text-left max-h-36 overflow-y-auto">
                        {info.reactors.map((reactor, idx) => {
                          const isSelf = reactor.id === currentUser?.id;
                          const name = isSelf ? 'You' : (reactor.display_name || reactor.email?.split('@')[0] || 'Member');
                          return (
                            <div key={reactor.id || idx} className="flex items-center gap-2 text-[10px]">
                              <img 
                                src={reactor.avatar_url || getRandomAvatar(reactor.email || name)} 
                                alt={name} 
                                className="w-4 h-4 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0"
                              />
                              <span className={`truncate ${isSelf ? 'font-bold text-sky-300' : 'text-slate-200'}`}>
                                {name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Tooltip triangle tail */}
                    <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1.5 border-r border-b border-white/10"></div>
                  </div>
                </div>
              );
            })}

            {/* Add Reaction Button (+ / Smile) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex items-center gap-0.5 text-xs"
                title="Add emoji reaction"
              >
                <Smile className="w-3.5 h-3.5" />
                <Plus className="w-2.5 h-2.5" />
              </button>

              {/* Reaction Picker Popover */}
              {showReactionPicker && (
                <div 
                  className="absolute left-0 bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40 animate-scale-in"
                  onMouseLeave={() => {
                    setShowReactionPicker(false);
                    setShowExtendedEmojis(false);
                  }}
                >
                  {/* Preset reactions required by user */}
                  <div className="flex items-center gap-1">
                    {PRESET_REACTIONS.map(({ emoji, label }) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleToggleReaction(emoji)}
                        className="p-1.5 hover:bg-slate-100 rounded-xl text-lg transition hover:scale-125 relative group/emoji"
                        title={label}
                      >
                        <span>{emoji}</span>
                        {/* Tooltip */}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] whitespace-nowrap opacity-0 group-hover/emoji:opacity-100 pointer-events-none transition shadow-sm font-medium z-50">
                          {label}
                        </span>
                      </button>
                    ))}

                    {/* + button for extra custom emojis */}
                    <button
                      type="button"
                      onClick={() => setShowExtendedEmojis(!showExtendedEmojis)}
                      className={`p-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center ${
                        showExtendedEmojis 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title="More emojis"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Extended Emoji Panel */}
                  {showExtendedEmojis && (
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <div className="grid grid-cols-6 gap-1 max-w-[200px]">
                        {EXTENDED_EMOJIS.map(em => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleToggleReaction(em)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-base hover:scale-110 transition"
                          >
                            {em}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleCustomEmojiSubmit} className="mt-2 flex items-center gap-1">
                        <input
                          type="text"
                          value={customEmojiInput}
                          onChange={(e) => setCustomEmojiInput(e.target.value)}
                          placeholder="Type emoji..."
                          maxLength={4}
                          className="w-full px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold"
                        >
                          Add
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subtle Divider */}
            <div className="h-3 w-px bg-slate-200/90 mx-0.5 self-center"></div>

            {/* Copy Button */}
            {post.content && (
              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                title="Copy message text"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 text-[11px] font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            )}

            {/* Quick Reply Button */}
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(post)}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                title="Reply to this message"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reply</span>
              </button>
            )}

            {/* Ask Idvy in OTR Button - Visible only if member has Off-chat access */}
            {onAskIdvyInOTR && canUseOTR && post.content && (
              <button
                type="button"
                onClick={() => onAskIdvyInOTR(post)}
                className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-50 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                title="Discuss this message with Idvy in Off-the-Record"
              >
                <EyeOff className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden md:inline">Ask in OTR</span>
              </button>
            )}

            {/* Options button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex items-center"
                title="Post options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div 
                  className="absolute left-0 bottom-full mb-1.5 w-40 bg-white rounded-xl shadow-xl border border-slate-200/90 p-1 z-30 animate-fade-in"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {post.content && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        handleCopyMessage();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy text</span>
                    </button>
                  )}
                  {onReply && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onReply(post);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5 text-blue-500" />
                      <span>Reply</span>
                    </button>
                  )}
                  {onAskIdvyInOTR && canUseOTR && post.content && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onAskIdvyInOTR(post);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-purple-600" />
                      <span>Ask Idvy in OTR</span>
                    </button>
                  )}
                  {isAuthor ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(post.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete post</span>
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-slate-400">
                      Collaborator post
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Size Image Viewer Modal */}
      {activeViewerImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 animate-fade-in"
          onClick={() => setActiveViewerImage(null)}
        >
          {/* Top Controls */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between py-2 text-white flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold truncate max-w-xs sm:max-w-md">
              {activeViewerImage.file_name}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.open(activeViewerImage.storage_path, '_blank')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                title="Open in a new page/tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in new page</span>
              </button>
              <a
                href={activeViewerImage.storage_path}
                download={activeViewerImage.file_name}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setActiveViewerImage(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title="Close viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Full Size Centered Image */}
          <div 
            className="flex-1 flex items-center justify-center p-2 max-w-5xl max-h-[82vh] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeViewerImage.storage_path}
              alt={activeViewerImage.file_name}
              className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl animate-scale-in"
            />
          </div>

          {/* Bottom helper text */}
          <div className="text-xs text-white/60 py-1 flex-shrink-0">
            Click anywhere outside or press X to close
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WHO REACTED MODAL (Mobile friendly & complete details)    */}
      {/* ======================================================== */}
      {activeReactorsModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveReactorsModal(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-xs w-full p-4 shadow-2xl border border-slate-200 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{activeReactorsModal.emoji}</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 capitalize">
                    {activeReactorsModal.label}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {activeReactorsModal.info.count} {activeReactorsModal.info.count === 1 ? 'person reacted' : 'people reacted'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReactorsModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2.5 max-h-60 overflow-y-auto space-y-2">
              {activeReactorsModal.info.reactors.map((reactor, idx) => {
                const isSelf = reactor.id === currentUser?.id;
                const name = isSelf ? 'You' : (reactor.display_name || reactor.email?.split('@')[0] || 'Member');
                return (
                  <div key={reactor.id || idx} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={reactor.avatar_url || getRandomAvatar(reactor.email || name)}
                        alt={name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
                      />
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {name} {isSelf && <span className="text-blue-600 font-semibold">(You)</span>}
                        </p>
                        {reactor.email && (
                          <p className="text-[10px] text-slate-400 truncate">{reactor.email}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-base flex-shrink-0">{activeReactorsModal.emoji}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
