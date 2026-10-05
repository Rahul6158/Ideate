import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  MoreHorizontal,
  Trash2,
  Layers,
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  CornerUpLeft,
  Globe,
  Quote,
  EyeOff
} from 'lucide-react';
import IdvyAvatar from './IdvyAvatar';
import { stripMarkdown } from '../../utils/textUtils';

export default function IdvyMessage({ 
  post, 
  onReply, 
  onJumpToMessage,
  onDelete,
  onDeleteAllIdvyPosts,
  isIdeaAuthor = false,
  onAskIdvyInOTR
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const content = post.content || '';
  const sources = post.ai_metadata?.sources || [];
  const command = post.ai_metadata?.command || null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Modern, rich markdown formatter
  const renderFormattedMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let inCodeBlock = false;
    let codeBlockLines = [];

    const flushTable = (key) => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(r => !r.every(c => /^[:\s-]+$/.test(c)));

        elements.push(
          <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-purple-200/80 bg-white/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-purple-50/90 border-b border-purple-200/80">
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 font-bold text-purple-950 border-r border-purple-100 last:border-r-0">
                      {renderInlineMarkdown(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-slate-700 border-r border-purple-100 last:border-r-0">
                        {renderInlineMarkdown(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    const flushCodeBlock = (key) => {
      if (codeBlockLines.length > 0) {
        elements.push(
          <div key={`code-${key}`} className="my-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 shadow-xs">
            <pre className="leading-relaxed">{codeBlockLines.join('\n')}</pre>
          </div>
        );
        codeBlockLines = [];
      }
      inCodeBlock = false;
    };

    lines.forEach((line, idx) => {
      // 1. Code Block boundary
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock(idx);
        } else {
          if (inTable) flushTable(idx);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      // 2. Markdown Table Detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        const cells = line.split('|').slice(1, -1);
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      // 3. Blockquotes: > quote
      if (line.trim().startsWith('>')) {
        const quoteText = line.trim().replace(/^>\s*/, '');
        elements.push(
          <div key={idx} className="my-2 pl-3.5 py-1 border-l-3 border-purple-400 bg-purple-50/60 rounded-r-xl text-xs sm:text-sm text-purple-900 italic flex items-start gap-2">
            <Quote className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{renderInlineMarkdown(quoteText)}</div>
          </div>
        );
        return;
      }

      // 4. Horizontal dividers: ---
      if (/^---+$/.test(line.trim())) {
        elements.push(<hr key={idx} className="my-3 border-t border-purple-200/60" />);
        return;
      }

      // 5. Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={idx} className="text-xs sm:text-sm font-bold text-purple-950 mt-3 mb-1.5 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
            <span>{line.replace('### ', '')}</span>
          </h4>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={idx} className="text-sm sm:text-base font-bold text-purple-950 mt-4 mb-2 pb-1 border-b border-purple-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span>{line.replace('## ', '')}</span>
          </h3>
        );
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={idx} className="text-base sm:text-lg font-extrabold text-purple-950 mt-4 mb-2 flex items-center gap-2">
            <span>{line.replace('# ', '')}</span>
          </h2>
        );
        return;
      }

      // 6. Bullet lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().replace(/^[-*]\s+/, '');
        elements.push(
          <li key={idx} className="text-xs sm:text-sm text-slate-800 ml-4 list-disc my-1 leading-relaxed marker:text-purple-500">
            {renderInlineMarkdown(itemText)}
          </li>
        );
        return;
      }

      // 7. Numbered lists
      if (/^\d+\.\s+/.test(line.trim())) {
        elements.push(
          <div key={idx} className="text-xs sm:text-sm text-slate-800 my-1 leading-relaxed pl-1 flex items-start gap-1.5">
            <span className="font-bold text-purple-700 flex-shrink-0">{line.trim().match(/^\d+\./)[0]}</span>
            <span>{renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ''))}</span>
          </div>
        );
        return;
      }

      // 8. Empty lines
      if (!line.trim()) {
        elements.push(<div key={idx} className="h-1.5" />);
        return;
      }

      // 9. Regular Paragraph
      elements.push(
        <p key={idx} className="text-xs sm:text-sm text-slate-800 leading-relaxed my-1">
          {renderInlineMarkdown(line)}
        </p>
      );
    });

    if (inTable) flushTable('end');
    if (inCodeBlock) flushCodeBlock('end');

    return elements;
  };

  // Inline bold, italics, mentions, code, links
  const renderInlineMarkdown = (line) => {
    // Splits on **bold**, `code`, [text](url), @mention, *italic*, _italic_
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|@[a-zA-Z0-9_.-]+|\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
          (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
        return <em key={i} className="italic text-purple-950 font-medium">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono text-[11px] font-medium border border-purple-200/50">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('@')) {
        return (
          <span key={i} className="inline-block px-1.5 py-0.2 rounded-md bg-purple-200/80 text-purple-900 font-bold text-xs mr-0.5 shadow-2xs">
            {part}
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
              className="text-purple-600 hover:text-purple-800 underline inline-flex items-center gap-0.5 font-medium"
            >
              {match[1]}
              <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>
          );
        }
      }
      // If there are stray unmatched ** tokens, clean them up
      const cleanPart = part.replace(/\*\*/g, '');
      return cleanPart;
    });
  };

  return (
    <div className="group relative flex items-start gap-3 sm:gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-purple-50/40 border border-purple-200/90 shadow-2xs hover:shadow-xs transition-all my-2">
      {/* Idvy Avatar */}
      <IdvyAvatar size="md" />

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-purple-950 tracking-tight flex items-center gap-1">
              Idvy
              <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
            </span>
            {command && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-purple-100/70 text-purple-800 font-mono text-[10px] font-semibold">
                /{command}
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-normal">
              {post.created_at || 'Just now'}
            </span>
          </div>

          {/* Quick action buttons & Author Delete Controls */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-100/60 transition"
              title="Copy Idvy's response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onReply && (
              <button
                type="button"
                onClick={() => onReply(post)}
                className="p-1 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-100/60 transition"
                title="Reply to Idvy"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {onAskIdvyInOTR && (
              <button
                type="button"
                onClick={() => onAskIdvyInOTR(post)}
                className="p-1 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-100/60 transition"
                title="Discuss this response with Idvy in Off-the-Record"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Author Delete Menu */}
            {isIdeaAuthor && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  className="p-1 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-100/60 transition flex items-center"
                  title="Idvy message options"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {showOptions && (
                  <div 
                    className="absolute right-0 bottom-full mb-1.5 w-48 bg-white rounded-xl shadow-xl border border-purple-200/90 p-1.5 z-40 animate-fade-in"
                    onMouseLeave={() => setShowOptions(false)}
                  >
                    {onAskIdvyInOTR && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOptions(false);
                          onAskIdvyInOTR(post);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-purple-600" />
                        <span>Discuss in OTR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowOptions(false);
                        handleCopy();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-purple-50 rounded-lg transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-purple-600" />
                      <span>Copy response</span>
                    </button>

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOptions(false);
                          onDelete(post.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete this message</span>
                      </button>
                    )}

                    {onDeleteAllIdvyPosts && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOptions(false);
                          if (window.confirm("Are you sure you want to remove ALL Idvy responses from this idea?")) {
                            onDeleteAllIdvyPosts();
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition border-t border-slate-100 mt-1 pt-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete all Idvy messages</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quoted Replying-To Banner */}
        {post.reply_to && (
          <div 
            onClick={() => onJumpToMessage && onJumpToMessage(post.reply_to.id)}
            className="mb-2 p-2 rounded-xl bg-purple-100/50 hover:bg-purple-100/80 border-l-3 border-purple-500 text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
            title="Click to jump to referenced message"
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
            <span className="font-bold text-purple-900">
              Replying to {post.reply_to.user_name || 'Member'}:
            </span>
            <span className="text-purple-800/80 truncate italic">
              "{stripMarkdown(post.reply_to.content || 'Attached file')}"
            </span>
          </div>
        )}

        {/* Body formatted - Always renders complete answer */}
        <div className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words space-y-1">
          {renderFormattedMarkdown(content)}
          {post.ai_metadata?.is_streaming && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-600 animate-pulse rounded-xs align-middle" title="Idvy is typing..." />
          )}
        </div>

        {/* Source citations for web research */}
        {sources && sources.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-purple-200/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-900 mb-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Verified Sources & Research Citations</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/80 hover:bg-purple-100/50 border border-purple-200/60 text-xs text-purple-800 transition truncate group/src"
                >
                  <span className="truncate font-medium">{src.title || 'Source ' + (i + 1)}</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 group-hover/src:text-purple-700 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
