import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Lock, 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  FileText,
  Lightbulb,
  ShieldAlert,
  EyeOff,
  ExternalLink,
  Share2,
  AtSign,
  Terminal,
  Zap,
  Quote,
  CornerUpRight,
  MessageSquare
} from 'lucide-react';
import IdvyAvatar from './IdvyAvatar';
import SlashCommandMenu from './SlashCommandMenu';
import { aiService, IDVY_BOT_USER, IDVY_SLASH_COMMANDS } from '../../services/aiService';
import { getRandomAvatar } from '../../data/avatars';

export default function IdvyPrivateSidebar({
  isOpen,
  onClose,
  idea,
  posts = [],
  members = [],
  currentUser,
  canUseOTR = false,
  initialPrompt = '',
  onClearInitialPrompt,
  onSendToIdeaChat,
  onSendAsIdvyToChat,
  onSendToComposer,
  onAnswerInMainChat
}) {
  const isOwner = idea?.owner_id === currentUser?.id || idea?.user_id === currentUser?.id || idea?.created_by === currentUser?.id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const hasOTRAccess = isOwner || isAdmin || canUseOTR === true;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sharedId, setSharedId] = useState(null);
  const [sentAsIdvyId, setSentAsIdvyId] = useState(null);
  const [sentToComposerId, setSentToComposerId] = useState(null);
  const [answeredInChatId, setAnsweredInChatId] = useState(null);

  // Command & Mention Autocomplete States
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [activeSlashIdx, setActiveSlashIdx] = useState(0);

  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);

  const chatScrollRef = useRef(null);
  const textareaRef = useRef(null);
  const slashMenuRef = useRef(null);
  const mentionMenuRef = useRef(null);

  const storageKey = `idvy_offtherecord_${idea?.id}_${currentUser?.id || 'anon'}`;
  const userName = currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Friend';

  // Load persisted private thread from localStorage
  useEffect(() => {
    if (!idea?.id) return;
    try {
      const saved = localStorage.getItem(storageKey);
      let parsed = null;
      if (saved) {
        try {
          parsed = JSON.parse(saved);
        } catch (_) {}
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed.filter(m => m && typeof m === 'object'));
      } else {
        const ideaTitle = idea?.title || 'this idea';
        const initialGreeting = {
          id: 'welcome-off-the-record',
          role: 'assistant',
          content: `Hey @${userName}! 🔒 **Welcome to your Off-the-Record space for "${ideaTitle}".**\n\nEverything we discuss here is strictly confidential and private between you and me:\n- **Zero footprint:** None of these messages appear in the public group chat or activity logs.\n- **Unfiltered thinking:** Test wild hypotheses, draft proposals, or spot blind spots before sharing them.\n- **Send to chat anytime:** Use **/inidchat [msg]** or click **Send to Input Box** on any message to post it into the public discussion!\n\nWhat would you like to explore off-the-record?`,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([initialGreeting]);
      }
    } catch (e) {
      console.warn('Failed to load off-the-record thread:', e);
    }
  }, [idea?.id, currentUser?.id, userName]);

  // Persist messages whenever they change
  useEffect(() => {
    if (!idea?.id || messages.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist off-the-record thread:', e);
    }
  }, [messages, storageKey]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle incoming initial prompt from /offtherecord or /private
  useEffect(() => {
    if (isOpen && initialPrompt) {
      const promptToRun = initialPrompt;
      if (onClearInitialPrompt) onClearInitialPrompt();
      handleSendMessage(promptToRun);
    }
  }, [isOpen, initialPrompt]);

  // Click outside to dismiss autocomplete menus
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setShowSlashMenu(false);
      }
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(e.target)) {
        setShowMentionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter members for mention menu
  const filteredMembers = [
    IDVY_BOT_USER,
    ...(Array.isArray(members) ? members : []).filter(Boolean).map(m => ({
      id: m.user_id || m.id,
      display_name: m.display_name || m.user?.display_name || m.email?.split('@')[0] || 'Collaborator',
      email: m.email || m.user?.email,
      avatar_url: m.avatar_url || m.user?.avatar_url,
      role: m.role
    }))
  ].filter(m => {
    if (!mentionQuery) return true;
    const nameMatch = (m.display_name || '').toLowerCase().includes(mentionQuery);
    const emailMatch = (m.email || '').toLowerCase().includes(mentionQuery);
    return nameMatch || emailMatch;
  });

  // Handle Text Change & Detect / or . commands or @ mentions
  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // 1. Check for / or . command trigger at start of input or newline
    const slashMatch = textBeforeCursor.match(/(?:^|\n)[\/.]([a-zA-Z0-9._]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setShowSlashMenu(true);
      setShowMentionMenu(false);
      setActiveSlashIdx(0);
      return;
    } else {
      setShowSlashMenu(false);
    }

    // 2. Check for @ mention trigger
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!/\s/.test(query) && query.length <= 30) {
        setMentionQuery(query.toLowerCase());
        setShowMentionMenu(true);
        setShowSlashMenu(false);
        setActiveMentionIdx(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const insertSlashCommand = (cmd) => {
    const cursor = textareaRef.current?.selectionStart ?? inputText.length;
    const textBeforeCursor = inputText.slice(0, cursor);
    const textAfterCursor = inputText.slice(cursor);
    const lastSlashIdx = Math.max(textBeforeCursor.lastIndexOf('/'), textBeforeCursor.lastIndexOf('.'));

    const newBefore = lastSlashIdx !== -1 ? textBeforeCursor.slice(0, lastSlashIdx) : textBeforeCursor;
    const commandText = `/${cmd.command} `;
    const updatedContent = `${newBefore}${commandText}${textAfterCursor}`;
    const newCursorPos = (newBefore + commandText).length;

    setInputText(updatedContent);
    setShowSlashMenu(false);
    setActiveSlashIdx(0);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const insertMention = (member) => {
    const name = String(member?.display_name || 'member').replace(/\s+/g, '_');
    const cursor = textareaRef.current?.selectionStart ?? inputText.length;
    const textBeforeCursor = inputText.slice(0, cursor);
    const textAfterCursor = inputText.slice(cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    let updatedContent;
    let newCursorPos;

    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const newBefore = textBeforeCursor.slice(0, lastAtIdx);
      const mentionText = `@${name} `;
      updatedContent = `${newBefore}${mentionText}${textAfterCursor}`;
      newCursorPos = (newBefore + mentionText).length;
    } else {
      const needsSpaceBefore = textBeforeCursor.length > 0 && !textBeforeCursor.endsWith(' ');
      const mentionText = `${needsSpaceBefore ? ' ' : ''}@${name} `;
      updatedContent = `${textBeforeCursor}${mentionText}${textAfterCursor}`;
      newCursorPos = (textBeforeCursor + mentionText).length;
    }

    setInputText(updatedContent);
    setShowMentionMenu(false);
    setActiveMentionIdx(0);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Clean slash query and matching commands for keyboard navigation
  const cleanSlashQuery = (slashQuery || '').replace(/^[\/.]/, '').toLowerCase();
  const filteredSlashCommands = IDVY_SLASH_COMMANDS.filter(cmd => 
    cmd.command.toLowerCase().includes(cleanSlashQuery) || 
    cmd.description.toLowerCase().includes(cleanSlashQuery) ||
    cmd.category.toLowerCase().includes(cleanSlashQuery) ||
    cmd.syntax.toLowerCase().includes(cleanSlashQuery)
  );

  const handleKeyDown = (e) => {
    // 1. Navigation in Slash Command Menu
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredSlashCommands.length > 0) {
          setActiveSlashIdx(prev => (prev + 1) % filteredSlashCommands.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredSlashCommands.length > 0) {
          setActiveSlashIdx(prev => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashCommands[activeSlashIdx] || filteredSlashCommands[0];
        if (selected) {
          insertSlashCommand(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    // 2. Navigation in Mention Menu
    if (showMentionMenu && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIdx(prev => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIdx(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredMembers[activeMentionIdx] || filteredMembers[0];
        if (selected) insertMention(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    // 3. Normal Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || isTyping) return;

    setInputText('');
    setShowSlashMenu(false);
    setShowMentionMenu(false);

    // 1. Check for explicit /inidchat, /post, /send, /say commands
    const isInIdChatCommand = /^\/inidchat\s+/i.test(text);
    const isExplicitPostCommand = /^\/(post|send|say)\s+/i.test(text);

    // 2. Check for natural language intent to post/send a message into the idea/team chat
    // Example: "hey idvy can you send a message in chat and cheerup the team"
    const naturalPostIntent = /(?:(?:can you|please|could you|hey idvy|idvy|go ahead and)?\s*(?:send|post|write|share|tell|drop|put)\s+(?:a\s+)?(?:message|note|update|shoutout|cheerup|cheer|thought)?\s*(?:in|to|into)\s+(?:the\s+)?(?:chat|team|discussion|group|main\s+chat))/i.test(text);

    if (isInIdChatCommand || isExplicitPostCommand || naturalPostIntent) {
      let rawPublicInstruction = text;
      if (isInIdChatCommand) {
        rawPublicInstruction = text.replace(/^\/inidchat\s+/i, '').trim();
      } else if (isExplicitPostCommand) {
        rawPublicInstruction = text.replace(/^\/(post|send|say)\s+/i, '').trim();
      }

      const userMsg = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      try {
        let messageToPost = rawPublicInstruction;

        if (isInIdChatCommand || naturalPostIntent || !isExplicitPostCommand) {
          const ideaTitle = idea?.title || 'this idea';
          const synthesisPrompt = `You are Idvy, the intelligent and creative resident AI collaborator on "${ideaTitle}".
A collaborator requested in private Off-the-Record chat: "${rawPublicInstruction}".

CRITICAL INSTRUCTIONS:
- You must formulate and post this message directly to the team in the public idea chat.
- Speak and act as a COMPLETELY INDEPENDENT, authentic collaborator on the project.
- NEVER say, hint, or imply that you were commanded, instructed, or told by someone to post this (e.g. NEVER say "Rahul asked me to cheer you guys up" or "At user's request").
- Speak directly to the team/collaborators with natural warmth, genuine positivity, and inspiring team spirit.
- Return ONLY the exact text to post into the main idea chat without meta-commentary or surrounding quotation marks.`;

          const aiGen = await aiService.callIdvyChat({
            ideaId: idea.id,
            idea,
            prompt: synthesisPrompt,
            userPrompt: synthesisPrompt,
            callerUser: currentUser,
            posts,
            members
          });

          if (aiGen?.content) {
            messageToPost = aiGen.content;
          }
        }

        if (onSendAsIdvyToChat && messageToPost) {
          await onSendAsIdvyToChat(messageToPost);
        } else if (onSendToIdeaChat && messageToPost) {
          await onSendToIdeaChat(messageToPost, false);
        }

        const confirmationMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: `🚀 **Posted to the idea chat as Idvy!**\n\nI shared this with everyone in the main discussion:\n\n> ${messageToPost.split('\n').join('\n> ')}\n\nYou can see it live in the discussion with native Idvy styling! ✨`,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, confirmationMsg]);
      } catch (err) {
        console.warn('Error executing inidchat command:', err);
        const errorMsg = {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `I couldn't post to the idea chat: ${err.message || 'Service busy'}. Please try again.`,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await aiService.callIdvyChat({
        ideaId: idea.id,
        idea,
        command: text.startsWith('/') ? null : (text.toLowerCase().includes('summar') ? 'summarize' : null),
        prompt: text,
        userPrompt: text,
        callerUser: currentUser,
        posts,
        members
      });

      const aiReply = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.content || "I'm right here with you off-the-record! What else would you like to explore?",
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiReply]);
    } catch (err) {
      console.warn('Off-the-record chat error:', err);
      const errorMsg = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `Hey @${userName}! I had a quick hiccup processing that: ${err.message || 'Service busy'}. Please ask again in just a moment.`,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendToIdeaChat = async (content) => {
    if (!content) return;
    try {
      if (onSendAsIdvyToChat) {
        await onSendAsIdvyToChat(content);
      } else if (onSendToIdeaChat) {
        await onSendToIdeaChat(content, false);
      }
      setSharedId(content);
      setTimeout(() => setSharedId(null), 3000);
    } catch (err) {
      console.warn('Failed to send to idea chat:', err);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all off-the-record chat history for this idea?')) {
      localStorage.removeItem(storageKey);
      const ideaTitle = idea?.title || 'this idea';
      const freshGreeting = {
        id: 'welcome-fresh',
        role: 'assistant',
        content: `Off-the-record history cleared! What confidential thoughts or strategies for **${ideaTitle}** should we dive into next, @${userName}?`,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([freshGreeting]);
    }
  };

  const handleCopy = (id, content) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Inline Markdown renderer with light theme colors
  const renderInlineMarkdown = (line) => {
    if (!line || typeof line !== 'string') return null;
    try {
      const parts = line.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|@[a-zA-Z0-9_.-]+|\*[^*]+\*|_[^_]+_)/g);
      return parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
            (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
          return <em key={i} className="italic text-purple-900 font-medium">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-800 font-mono text-xs font-semibold border border-purple-200/50">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('@')) {
          return (
            <span key={i} className="inline-block px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-bold text-xs mr-0.5 shadow-2xs">
              {part}
            </span>
          );
        }
        if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
          const splitIdx = part.indexOf('](');
          if (splitIdx !== -1) {
            const title = part.slice(1, splitIdx);
            const url = part.slice(splitIdx + 2, -1);
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 hover:text-purple-800 underline font-medium inline-flex items-center gap-0.5"
              >
                <span>{title}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            );
          }
        }
        return part.replace(/\*\*/g, '');
      });
    } catch (_) {
      return line;
    }
  };

  // Block Markdown renderer
  const renderFormattedMarkdown = (text) => {
    if (!text || typeof text !== 'string') return null;
    try {
      const lines = text.split('\n');
      const elements = [];
      let inTable = false;
      let tableRows = [];
      let inCodeBlock = false;
      let codeBlockLines = [];

      const flushTable = (key) => {
        if (Array.isArray(tableRows) && tableRows.length > 0) {
          const headerRow = Array.isArray(tableRows[0]) ? tableRows[0] : [];
          const bodyRows = tableRows.slice(1).filter(r => Array.isArray(r) && !r.every(c => typeof c === 'string' && /^[:\s-]+$/.test(c.trim())));

          if (headerRow.length > 0) {
            elements.push(
              <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-purple-200/80 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-purple-50/90 border-b border-purple-200/80">
                      {headerRow.map((cell, cIdx) => (
                        <th key={cIdx} className="px-3 py-2 font-bold text-purple-950 border-r border-purple-100 last:border-r-0">
                          {renderInlineMarkdown(String(cell || '').trim())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                        {(Array.isArray(row) ? row : []).map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-700 border-r border-purple-100 last:border-r-0">
                            {renderInlineMarkdown(String(cell || '').trim())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          tableRows = [];
        }
        inTable = false;
      };

      const flushCodeBlock = (key) => {
        if (Array.isArray(codeBlockLines) && codeBlockLines.length > 0) {
          elements.push(
            <div key={`code-${key}`} className="my-2.5 p-3.5 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800 shadow-xs">
              <pre className="leading-relaxed">{codeBlockLines.join('\n')}</pre>
            </div>
          );
          codeBlockLines = [];
        }
        inCodeBlock = false;
      };

      lines.forEach((line, idx) => {
        if (typeof line !== 'string') return;

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

        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          inTable = true;
          const cells = line.split('|').slice(1, -1);
          tableRows.push(cells);
          return;
        } else if (inTable) {
          flushTable(idx);
        }

        if (line.trim().startsWith('>')) {
          const quoteText = line.trim().replace(/^>\s*/, '');
          elements.push(
            <div key={idx} className="my-2.5 pl-3.5 py-1.5 border-l-3 border-purple-400 bg-purple-50/70 rounded-r-xl text-xs sm:text-[13px] text-purple-900 italic flex items-start gap-2">
              <Quote className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{renderInlineMarkdown(quoteText)}</div>
            </div>
          );
          return;
        }

        if (line.trim().startsWith('### ')) {
          elements.push(
            <h4 key={idx} className="font-bold text-xs sm:text-sm text-purple-900 mt-2.5 mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
              <span>{renderInlineMarkdown(line.trim().replace(/^###\s+/, ''))}</span>
            </h4>
          );
          return;
        }

        if (line.trim().startsWith('## ')) {
          elements.push(
            <h3 key={idx} className="font-bold text-sm sm:text-base text-purple-950 mt-3.5 mb-1.5 pb-1 border-b border-purple-100 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
              <span>{renderInlineMarkdown(line.trim().replace(/^##\s+/, ''))}</span>
            </h3>
          );
          return;
        }

        if (line.trim().startsWith('# ')) {
          elements.push(
            <h2 key={idx} className="font-extrabold text-base sm:text-lg text-purple-950 mt-4 mb-2 pb-1 border-b border-purple-200">
              {renderInlineMarkdown(line.trim().replace(/^#\s+/, ''))}
            </h2>
          );
          return;
        }

        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const bulletText = line.trim().replace(/^[-*]\s+/, '');
          elements.push(
            <div key={idx} className="flex items-start gap-2 my-1 pl-1 text-[13.5px] text-slate-800 leading-relaxed">
              <span className="text-purple-600 font-bold select-none text-base leading-none mt-0.5">•</span>
              <span className="flex-1">{renderInlineMarkdown(bulletText)}</span>
            </div>
          );
          return;
        }

        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          elements.push(
            <div key={idx} className="flex items-start gap-2 my-1 pl-1 text-[13.5px] text-slate-800 leading-relaxed">
              <span className="font-bold text-purple-700 min-w-4 text-right text-xs mt-0.5">{numMatch[1]}.</span>
              <span className="flex-1">{renderInlineMarkdown(numMatch[2])}</span>
            </div>
          );
          return;
        }

        if (!line.trim()) {
          elements.push(<div key={idx} className="h-1.5" />);
          return;
        }

        elements.push(
          <p key={idx} className="my-1.5 text-[13.5px] text-slate-800 leading-relaxed font-normal">
            {renderInlineMarkdown(line)}
          </p>
        );
      });

      if (inTable) flushTable('end');
      if (inCodeBlock) flushCodeBlock('end');

      return elements;
    } catch (err) {
      console.warn('renderFormattedMarkdown fallback:', err);
      return <p className="my-1.5 text-[13.5px] text-slate-800 leading-relaxed whitespace-pre-wrap">{text}</p>;
    }
  };

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 h-full max-h-full flex flex-col bg-[#f8fafc] border-l border-slate-200/90 shadow-lg z-20 overflow-hidden animate-slide-left relative">
      {/* Sleek Floating Controls (Clear & Close) - Zero Header Space */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-md rounded-full px-1.5 py-0.5 border border-slate-200/80 shadow-xs">
        <button
          type="button"
          onClick={handleClearHistory}
          className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
          title="Clear off-the-record history"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          title="Close off-the-record space"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Suggested Quick Prompt Chips (Compact Row at very top, no header above) */}
      <div className="pt-2.5 pb-2 px-3 bg-white/80 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 pr-20">
        <button
          type="button"
          onClick={() => handleSendMessage('Please summarize all team discussions and member proposals off-the-record.')}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-50 text-[11px] font-semibold text-slate-700 hover:text-purple-700 border border-slate-200 transition active:scale-95 shadow-2xs"
        >
          <FileText className="w-3 h-3 text-purple-600" />
          <span>Summarize</span>
        </button>

        <button
          type="button"
          onClick={() => handleSendMessage('What are the biggest hidden blindspots or risks with this concept?')}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-50 text-[11px] font-semibold text-slate-700 hover:text-amber-800 border border-slate-200 transition active:scale-95 shadow-2xs"
        >
          <ShieldAlert className="w-3 h-3 text-amber-600" />
          <span>Spot risks</span>
        </button>

        <button
          type="button"
          onClick={() => handleSendMessage('Give me 3 creative, bold ideas to make this concept 10x better.')}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-[11px] font-semibold text-slate-700 hover:text-indigo-800 border border-slate-200 transition active:scale-95 shadow-2xs"
        >
          <Lightbulb className="w-3 h-3 text-indigo-600" />
          <span>Brainstorm</span>
        </button>
      </div>

      {!hasOTRAccess ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3.5 bg-[#f8fafc]">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Off-Chat Access Reserved</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Off-the-Record private AI chat is reserved for the idea owner by default.
              Ask @{idea?.owner_name || 'the idea owner'} to grant you Off-chat access in AI Permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition active:scale-95"
          >
            Close Off-the-Record
          </button>
        </div>
      ) : (
        <>
          {/* Messages Scroll Area */}
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-[#f8fafc] min-h-0"
          >
        {(Array.isArray(messages) ? messages : []).filter(m => m && typeof m === 'object').map((m, mIdx) => {
          const isUser = m.role === 'user';
          const contentStr = typeof m.content === 'string'
            ? m.content
            : (m.content?.text || m.content?.content || (m.content ? JSON.stringify(m.content) : ''));
          const timeStr = typeof m.created_at === 'string'
            ? m.created_at
            : (m.created_at ? String(m.created_at) : '');

          return (
            <div
              key={m.id || mIdx}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
            >
              {/* Avatar */}
              {isUser ? (
                <img
                  src={currentUser?.avatar_url || getRandomAvatar(currentUser?.email || userName)}
                  alt={userName}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-2xs flex-shrink-0 mt-0.5"
                />
              ) : (
                <div className="flex-shrink-0 mt-0.5">
                  <IdvyAvatar size="sm" />
                </div>
              )}

              {/* Message Bubble / Card */}
              {isUser ? (
                /* User Bubble: Clean message + time ONLY (no header, strictly message & timestamp) */
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs text-[13.5px] leading-relaxed">
                  <div className="break-words font-medium whitespace-pre-wrap">{contentStr}</div>
                  <div className="text-[10px] text-blue-200 text-right mt-1 font-mono select-none">
                    {timeStr}
                  </div>
                </div>
              ) : (
                /* Idvy Response Card: Elevated rich styling */
                <div className="max-w-[92%] rounded-2xl rounded-tl-xs p-4 bg-white border border-purple-100/90 text-slate-800 shadow-xs text-[13.5px] leading-relaxed">
                  {/* Idvy Card Header */}
                  <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-purple-50 text-xs text-slate-400">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>Idvy</span>
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span>{timeStr}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(m.id, contentStr)}
                        className="p-1 hover:bg-purple-50 rounded text-slate-400 hover:text-purple-600 transition"
                        title="Copy text"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Formatted Markdown Content */}
                  <div className="break-words space-y-1 text-slate-800">
                    {renderFormattedMarkdown(contentStr)}
                  </div>

                  {/* Action Buttons: Send to Input Box & Post as Idvy */}
                  {(onSendToComposer || onSendAsIdvyToChat || onSendToIdeaChat) && (
                    <div className="mt-3 pt-2.5 border-t border-purple-50 flex items-center justify-end gap-2 flex-wrap">
                      {onSendToComposer && (
                        <button
                          type="button"
                          onClick={() => {
                            onSendToComposer(m.content);
                            setSentToComposerId(m.id);
                            setTimeout(() => setSentToComposerId(null), 2500);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-[11px] font-semibold text-slate-700 transition border border-slate-200 active:scale-95 shadow-2xs"
                          title="Put this answer into the main chat input box so you can tweak and send"
                        >
                          <CornerUpRight className="w-3 h-3 text-slate-500" />
                          <span>{sentToComposerId === m.id ? 'Sent to Input! ✓' : 'Send to Input Box'}</span>
                        </button>
                      )}

                      {onAnswerInMainChat && (
                        <button
                          type="button"
                          onClick={async () => {
                            const mIdx = messages.findIndex(msg => msg.id === m.id);
                            const prevUserMsg = mIdx > 0 ? messages.slice(0, mIdx).reverse().find(msg => msg.role === 'user') : null;
                            const questionText = prevUserMsg ? prevUserMsg.content : '';
                            await onAnswerInMainChat({ question: questionText, answer: m.content });
                            setAnsweredInChatId(m.id);
                            setTimeout(() => setAnsweredInChatId(null), 2500);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[11px] font-semibold text-indigo-700 transition border border-indigo-200 active:scale-95 shadow-2xs"
                          title="Have Idvy answer this question directly in the main team discussion"
                        >
                          <MessageSquare className="w-3 h-3 text-indigo-600" />
                          <span>{answeredInChatId === m.id ? 'Answering in Chat! ✓' : 'Answer in Main Chat'}</span>
                        </button>
                      )}

                      {onSendAsIdvyToChat ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onSendAsIdvyToChat(m.content);
                            setSentAsIdvyId(m.id);
                            setTimeout(() => setSentAsIdvyId(null), 2500);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[11px] font-semibold text-purple-700 transition border border-purple-200 active:scale-95 shadow-2xs"
                          title="Directly post this into the main discussion as Idvy with full styling"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600 fill-purple-100" />
                          <span>{sentAsIdvyId === m.id ? 'Posted as Idvy! ✓' : 'Post as Idvy'}</span>
                        </button>
                      ) : onSendToIdeaChat && (
                        <button
                          type="button"
                          onClick={() => handleSendToIdeaChat(m.content)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[11px] font-semibold text-purple-700 transition border border-purple-200 active:scale-95 shadow-2xs"
                          title="Post this to the public idea discussion chat"
                        >
                          <Share2 className="w-3 h-3 text-purple-600" />
                          <span>{sharedId === m.content ? 'Posted! ✓' : 'Post to Chat'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Private Typing Indicator */}
        {isTyping && (
          <div className="flex items-start gap-2 animate-fade-in">
            <IdvyAvatar size="sm" />
            <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-3 py-2 text-xs text-slate-700 flex items-center gap-2 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
              </span>
              <span className="font-medium text-slate-500 text-[11px]">
                Idvy is typing off-the-record for @{userName}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* INPUT COMPOSER (Matched to Main Chat Rounded Styling)    */}
      {/* ======================================================== */}
      <div className="p-3 bg-white border-t border-slate-200/90 flex-shrink-0 relative">
        {/* SLASH COMMAND POPUP MENU (Triggered by / OR .) */}
        {showSlashMenu && (
          <div ref={slashMenuRef} className="absolute left-3 right-3 bottom-full mb-2 z-50">
            <SlashCommandMenu
              query={slashQuery}
              activeIndex={activeSlashIdx}
              onHoverIndex={setActiveSlashIdx}
              onSelectCommand={insertSlashCommand}
            />
          </div>
        )}

        {/* MENTION POPUP MENU (Triggered by @) */}
        {showMentionMenu && filteredMembers.length > 0 && (
          <div 
            ref={mentionMenuRef}
            className="absolute left-3 right-3 bottom-full mb-2 max-h-56 overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-scale-in"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
              <span>Tag Collaborator</span>
              <span className="text-[10px] text-slate-400 font-normal">↑↓ navigate · ↵ select</span>
            </div>
            <div className="space-y-0.5">
              {filteredMembers.map((m, index) => {
                const isSelected = index === activeMentionIdx;
                const isIdvy = m.is_ai || m.id === IDVY_BOT_USER.id || m.email === 'idvy@ideate.app';
                return (
                  <button
                    key={m.id || m.email || index}
                    type="button"
                    onClick={() => insertMention(m)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isIdvy ? (
                      <IdvyAvatar size="xs" />
                    ) : (
                      <img
                        src={m.avatar_url || getRandomAvatar(m.email || m.display_name)}
                        alt={m.display_name}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    )}
                    <span className="truncate flex-1 font-semibold">{m.display_name}</span>
                    {isIdvy && (
                      <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1 rounded">AI</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Card Container matching Chat Composer */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 focus-within:bg-white focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 shadow-2xs transition-all p-2">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={`Ask off-the-record or type / or . for commands...`}
            rows={2}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setInputText(prev => prev + '@');
                  setShowMentionMenu(true);
                  textareaRef.current?.focus();
                }}
                className="p-1 rounded-lg hover:text-blue-600 hover:bg-slate-100 transition"
                title="Tag collaborator"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText(prev => prev.trim() ? prev + ' /' : '/');
                  setShowSlashMenu(true);
                  textareaRef.current?.focus();
                }}
                className="p-1 rounded-lg hover:text-purple-600 hover:bg-slate-100 transition"
                title="Slash commands (type / or .)"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>

              <span className="text-[10px] text-slate-400 hidden sm:inline ml-1 font-medium">
                Type <span className="font-mono font-bold text-purple-700">/</span> or <span className="font-mono font-bold text-purple-700">.</span> for commands
              </span>
            </div>

            <button
              type="button"
              disabled={!inputText.trim() || isTyping}
              onClick={() => handleSendMessage()}
              className={`p-1.5 rounded-xl font-bold transition flex items-center justify-center ${
                !inputText.trim() || isTyping
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs active:scale-95'
              }`}
              title="Send off-the-record message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1.5 px-1 font-medium">
          <span className="flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-amber-500" />
            <span>Off-the-Record · Not stored in public feed</span>
          </span>
          <span className="text-purple-600 font-semibold">
            Tip: /inidchat [msg] sends directly to group chat
          </span>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
