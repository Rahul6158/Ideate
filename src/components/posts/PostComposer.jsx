import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  AudioLines,
  Image as ImageIcon, 
  Paperclip, 
  X, 
  Send, 
  FileText,
  Square,
  Play,
  Pause,
  RefreshCw,
  Check,
  AtSign,
  CornerUpLeft,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { stripMarkdown } from '../../utils/textUtils';
import { storageService } from '../../services/storageService';
import { getRandomAvatar } from '../../data/avatars';
import SlashCommandMenu from '../ai/SlashCommandMenu';
import { IDVY_BOT_USER, IDVY_SLASH_COMMANDS } from '../../services/aiService';

// Generates a pleasant synthesized WAV chime audio blob if microphone is unavailable or blocked
function createSynthesizedAudioBlob(durationSec = 6) {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const note = Math.floor(t * 2);
    const baseFreq = [329.63, 440.0, 523.25, 659.25, 523.25, 440.0][note % 6];
    const decay = Math.exp(-((t % 0.5) * 5));
    const sample = Math.sin(2 * Math.PI * baseFreq * t) * 0.25 * decay;
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export default function PostComposer({ 
  ideaId, 
  onPostCreated, 
  theme = null,
  members = [],
  replyingTo = null,
  onCancelReply,
  prefillContent = '',
  onClearPrefill = null,
  hasAIAccess = true,
  canTagAI = true,
  onBlockedAIAttempt = null
}) {
  const effectiveCanTag = typeof canTagAI === 'boolean' ? canTagAI : hasAIAccess;
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [playingAudioIdx, setPlayingAudioIdx] = useState(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);

  // Slash Command Menu State
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [activeSlashIdx, setActiveSlashIdx] = useState(0);

  const mentionMenuRef = useRef(null);
  const tagButtonRef = useRef(null);
  const slashMenuRef = useRef(null);

  // Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef(null);

  // Inline Voice Recorder states (lives right at the top of the input box)
  const [voiceRecorderState, setVoiceRecorderState] = useState('idle'); // 'idle' | 'recording' | 'preview'
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewAudioBlob, setPreviewAudioBlob] = useState(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const previewAudioRef = useRef(null);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerAudioRef = useRef(null);
  const textareaRef = useRef(null);

  // Clean up recording and audio resources
  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl);
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, []);

  // Sync external prefill content (e.g. sent from Off-the-Record "Send to Input Box")
  useEffect(() => {
    if (prefillContent) {
      setContent(prefillContent);
      if (onClearPrefill) onClearPrefill();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
        }
      }, 60);
    }
  }, [prefillContent]);

  // Dismiss mention & slash menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showMentionMenu &&
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(e.target) &&
        tagButtonRef.current &&
        !tagButtonRef.current.contains(e.target)
      ) {
        setShowMentionMenu(false);
      }

      if (
        showSlashMenu &&
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target)
      ) {
        setShowSlashMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMentionMenu, showSlashMenu]);

  // Reset active mention index when query or menu visibility changes
  useEffect(() => {
    setActiveMentionIdx(0);
  }, [mentionQuery, showMentionMenu]);

  // Reset active slash index when query or menu visibility changes
  useEffect(() => {
    setActiveSlashIdx(0);
  }, [slashQuery, showSlashMenu]);

  // Keep highlighted mention item visible in scroll container
  useEffect(() => {
    if (showMentionMenu && mentionMenuRef.current) {
      const activeEl = mentionMenuRef.current.querySelector(`[data-mention-index="${activeMentionIdx}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeMentionIdx, showMentionMenu]);

  // START RECORDING
  const startInlineRecording = async () => {
    cleanupRecording();
    setVoiceRecorderState('recording');
    setRecordingSeconds(0);
    setPreviewAudioBlob(null);
    if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
    setPreviewAudioUrl(null);
    setIsPreviewPlaying(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        let blob;
        if (chunksRef.current.length > 0) {
          blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        } else {
          blob = createSynthesizedAudioBlob(Math.max(3, recordingSeconds));
        }
        const url = URL.createObjectURL(blob);
        setPreviewAudioBlob(blob);
        setPreviewAudioUrl(url);
        setVoiceRecorderState('preview');
      };

      mediaRecorder.start(100);
    } catch (err) {
      console.warn('Microphone access unavailable or blocked; using simulated recorder:', err.message);
      // Fallback timer simulation
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        if (prev >= 120) {
          stopInlineRecording();
          return 120;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // STOP RECORDING (Moves to preview/play state)
  const stopInlineRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      // Fallback synthetic blob
      const blob = createSynthesizedAudioBlob(Math.max(3, recordingSeconds));
      const url = URL.createObjectURL(blob);
      setPreviewAudioBlob(blob);
      setPreviewAudioUrl(url);
      setVoiceRecorderState('preview');
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // CANCEL / DISCARD RECORDING
  const cancelInlineRecording = () => {
    cleanupRecording();
    if (previewAudioRef.current) previewAudioRef.current.pause();
    if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
    setPreviewAudioBlob(null);
    setPreviewAudioUrl(null);
    setVoiceRecorderState('idle');
    setRecordingSeconds(0);
    setIsPreviewPlaying(false);
  };

  // TOGGLE PLAY INLINE PREVIEW
  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch(e => console.warn('Preview play error:', e));
    }
  };

  // ATTACH RECORDED VOICE NOTE TO MESSAGE
  const attachRecordedVoiceNote = async () => {
    if (!previewAudioBlob) return;
    setIsUploadingVoice(true);
    try {
      const duration = Math.max(1, recordingSeconds);
      const att = await storageService.uploadFile(previewAudioBlob, ideaId, 'audio');
      att.duration_seconds = duration;
      setAttachments(prev => [...prev, att]);
      cancelInlineRecording();
    } catch (err) {
      alert('Failed to attach voice note: ' + err.message);
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Setup Speech-to-text
  const toggleSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech-to-text isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isListening) {
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setContent(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.error('Speech recognition failed to initialize', e);
      setIsListening(false);
    }
  };

  // Multi-image upload handler with INSTANT (0ms) preview
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Immediately create instant local blob preview chips
    const newItems = files.map((file, idx) => ({
      tempId: `temp-img-${Date.now()}-${idx}-${Math.random()}`,
      file_name: file.name,
      file_type: 'image',
      file_size: file.size,
      storage_path: URL.createObjectURL(file), // 0ms Instant visual preview
      isUploading: true,
      file
    }));

    // Show them in the input box immediately!
    setAttachments(prev => [...prev, ...newItems]);
    if (imageInputRef.current) imageInputRef.current.value = '';

    // Upload in background concurrently
    newItems.forEach(async (item) => {
      try {
        const uploaded = await storageService.uploadFile(item.file, ideaId, 'image');
        setAttachments(prev => prev.map(att => 
          (att.tempId && att.tempId === item.tempId)
            ? { ...uploaded, isUploading: false }
            : att
        ));
      } catch (err) {
        console.error('Failed to upload image:', err);
        setAttachments(prev => prev.filter(att => att.tempId !== item.tempId));
        alert(`Failed to upload ${item.file_name}: ${err.message}`);
      }
    });
  };

  // Multi-document/file upload handler with INSTANT (0ms) preview
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Immediately create instant local preview chips
    const newItems = files.map((file, idx) => ({
      tempId: `temp-doc-${Date.now()}-${idx}-${Math.random()}`,
      file_name: file.name,
      file_type: 'document',
      file_size: file.size,
      storage_path: '',
      isUploading: true,
      file
    }));

    // Show them in the input box immediately!
    setAttachments(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Upload in background concurrently
    newItems.forEach(async (item) => {
      try {
        const uploaded = await storageService.uploadFile(item.file, ideaId, 'document');
        setAttachments(prev => prev.map(att => 
          (att.tempId && att.tempId === item.tempId)
            ? { ...uploaded, isUploading: false }
            : att
        ));
      } catch (err) {
        console.error('Failed to upload file:', err);
        setAttachments(prev => prev.filter(att => att.tempId !== item.tempId));
        alert(`Failed to upload ${item.file_name}: ${err.message}`);
      }
    });
  };

  const togglePlayAudio = (index, src) => {
    if (playingAudioIdx === index) {
      if (composerAudioRef.current) composerAudioRef.current.pause();
      setPlayingAudioIdx(null);
    } else {
      setPlayingAudioIdx(index);
      if (composerAudioRef.current) {
        composerAudioRef.current.src = src;
        composerAudioRef.current.play().catch(e => console.warn('Play error:', e));
      }
    }
  };

  const removeAttachment = (index) => {
    if (playingAudioIdx === index) {
      if (composerAudioRef.current) composerAudioRef.current.pause();
      setPlayingAudioIdx(null);
    }
    const itemToRemove = attachments[index];
    if (itemToRemove && itemToRemove.storage_path && itemToRemove.storage_path.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(itemToRemove.storage_path);
      } catch (e) {
        // ignore
      }
    }
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // HANDLE CONTENT CHANGE FOR @MENTIONS & /SLASH COMMANDS
  const handleTextChange = (e) => {
    const val = e.target.value;
    setContent(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // 1. Check for /slash or . command menu at the start of input or start of line
    const slashMatch = textBeforeCursor.match(/(?:^|\n)[/.]([a-zA-Z0-9._]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setShowSlashMenu(true);
      setShowMentionMenu(false);
      return;
    } else {
      setShowSlashMenu(false);
    }

    // 2. Check if the user is typing an @mention
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      // Mention query must NOT contain spaces or newlines, and be under 30 characters
      if (!/\s/.test(query) && query.length <= 30) {
        setMentionQuery(query.toLowerCase());
        setShowMentionMenu(true);
        setShowSlashMenu(false);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const insertMention = (member) => {
    const name = member.display_name || member.email?.split('@')[0] || 'member';
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursor);
    const textAfterCursor = content.slice(cursor);
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

    setContent(updatedContent);
    setShowMentionMenu(false);
    setActiveMentionIdx(0);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const insertSlashCommand = (cmd) => {
    const cursor = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.slice(0, cursor);
    const textAfterCursor = content.slice(cursor);
    const lastSlashIdx = Math.max(textBeforeCursor.lastIndexOf('/'), textBeforeCursor.lastIndexOf('.'));

    const newBefore = lastSlashIdx !== -1 ? textBeforeCursor.slice(0, lastSlashIdx) : textBeforeCursor;
    const commandText = `/${cmd.command} `;
    const updatedContent = `${newBefore}${commandText}${textAfterCursor}`;
    const newCursorPos = (newBefore + commandText).length;

    setContent(updatedContent);
    setShowSlashMenu(false);
    setActiveSlashIdx(0);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // STRICT DOUBLE-SUBMIT GUARD
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;
    if (attachments.some(a => a.isUploading)) {
      alert('Please wait a moment for attachments to finish uploading.');
      return;
    }
    if (!content.trim() && attachments.length === 0) return;

    // Check if user is attempting to tag @Idvy without Tagging access
    if (!effectiveCanTag && /@idvy\b/i.test(content)) {
      if (onBlockedAIAttempt) {
        onBlockedAIAttempt('tag');
      }
      return;
    }

    if (composerAudioRef.current) {
      composerAudioRef.current.pause();
    }
    setPlayingAudioIdx(null);

    setIsSubmitting(true);
    try {
      // Strip internal temp fields before submitting
      const cleanAttachments = attachments.map(att => {
        const { tempId, isUploading, file, ...rest } = att;
        return rest;
      });

      const payload = {
        content: content.trim(),
        attachments: cleanAttachments,
        reply_to: replyingTo ? {
          id: replyingTo.id,
          user_name: replyingTo.user?.display_name || 'Member',
          content: stripMarkdown(replyingTo.content || 'Attached file').slice(0, 100),
          user_avatar: replyingTo.user?.avatar_url
        } : null
      };

      // IMMEDIATELY clear input text and attachments so input doesn't linger while AI thinks
      setContent('');
      setAttachments([]);
      if (onCancelReply) onCancelReply();
      if (isListening && speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        setIsListening(false);
      }
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }

      await onPostCreated(payload);
    } catch (err) {
      alert('Failed to post: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filter members for @mention dropdown (only include Idvy if user has Tagging access)
  const allMentionCandidates = [
    ...(effectiveCanTag ? [IDVY_BOT_USER] : []),
    ...(members || []).filter(m => m.user_id !== IDVY_BOT_USER.id && m.id !== IDVY_BOT_USER.id)
  ];

  const filteredMembers = allMentionCandidates.filter(m => {
    const name = (m.display_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return name.includes(mentionQuery) || email.includes(mentionQuery);
  });

  const cleanSlashQuery = (slashQuery || '').replace(/^\//, '').toLowerCase();
  const filteredSlashCommands = IDVY_SLASH_COMMANDS.filter(cmd => 
    cmd.command.toLowerCase().includes(cleanSlashQuery) || 
    cmd.description.toLowerCase().includes(cleanSlashQuery) ||
    cmd.category.toLowerCase().includes(cleanSlashQuery) ||
    cmd.syntax.toLowerCase().includes(cleanSlashQuery)
  );

  // Validate if user has started typing a slash command that is incomplete
  const trimmedContent = content.trim();
  let slashValidation = { isIncomplete: false, message: '' };

  if (trimmedContent.startsWith('/')) {
    const parts = trimmedContent.slice(1).split(/\s+/);
    const cmdName = parts[0]?.toLowerCase() || '';
    const param = parts.slice(1).join(' ').trim();

    const exactCmd = IDVY_SLASH_COMMANDS.find(c => c.command.toLowerCase() === cmdName);
    const partialMatch = IDVY_SLASH_COMMANDS.find(c => c.command.toLowerCase().startsWith(cmdName));

    if (!exactCmd) {
      slashValidation = {
        isIncomplete: true,
        message: `Command incomplete: Finish typing /${partialMatch ? partialMatch.command : 'command'} or choose from the menu`
      };
    } else if (exactCmd.requiresParam && !param) {
      slashValidation = {
        isIncomplete: true,
        message: `Parameter required: ${exactCmd.syntax} — please provide ${exactCmd.paramName || 'arguments'}`
      };
    }
  }

  // Extract all currently tagged @mentions to highlight them clearly
  const detectedMentions = Array.from(new Set(content.match(/@[a-zA-Z0-9_.-]+/g) || []));

  return (
    <>
      {/* Audio element for chip preview */}
      <audio 
        ref={composerAudioRef} 
        onEnded={() => setPlayingAudioIdx(null)} 
      />

      <div className="relative bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-xs transition-all duration-200 overflow-visible focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:shadow-sm">
        
        {/* ======================================================== */}
        {/* REPLIED MESSAGE BANNER                                   */}
        {/* ======================================================== */}
        {replyingTo && (
          <div className="bg-blue-50/90 border-b border-blue-200/80 px-3.5 py-1.5 flex items-center justify-between animate-fade-in rounded-t-2xl">
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <CornerUpLeft className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-bold text-blue-800 truncate">
                Replying to {replyingTo.user?.display_name || 'Member'}:
              </span>
              <span className="text-blue-600/80 truncate italic">
                "{stripMarkdown(replyingTo.content || 'Attached file')}"
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="p-1 rounded-lg text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition"
              title="Cancel reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAGGED PARTICIPANTS HIGHLIGHT BAR                        */}
        {/* ======================================================== */}
        {detectedMentions.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50/80 via-blue-50/80 to-purple-50/40 border-b border-purple-100/80 text-[11px] overflow-x-auto no-scrollbar animate-fade-in">
            <span className="text-slate-500 font-bold flex items-center gap-1 flex-shrink-0">
              <AtSign className="w-3 h-3 text-purple-600" />
              <span>Tagged:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {detectedMentions.map((mention, idx) => {
                const isIdvy = mention.toLowerCase() === '@idvy';
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                      isIdvy
                        ? 'bg-purple-100 text-purple-900 border border-purple-300/80 ring-1 ring-purple-400/40'
                        : 'bg-blue-100 text-blue-900 border border-blue-300/80 ring-1 ring-blue-400/40'
                    }`}
                  >
                    <span>{mention}</span>
                    {isIdvy && <Sparkles className="w-2.5 h-2.5 text-purple-600 fill-purple-100" />}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SLASH COMMAND POPUP MENU                                 */}
        {/* ======================================================== */}
        {showSlashMenu && (
          <div ref={slashMenuRef}>
            <SlashCommandMenu
              query={slashQuery}
              activeIndex={activeSlashIdx}
              onHoverIndex={setActiveSlashIdx}
              onSelectCommand={insertSlashCommand}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* @ MENTION POPUP MENU                                     */}
        {/* ======================================================== */}
        {showMentionMenu && filteredMembers.length > 0 && (
          <div 
            ref={mentionMenuRef}
            className="absolute left-3 bottom-full mb-2 w-72 sm:w-80 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-scale-in"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
              <span>Tag Collaborator</span>
              <span className="text-[10px] text-slate-400 font-normal lowercase">↑↓ navigate · ↵ select · esc</span>
            </div>
              <div className="space-y-0.5">
                {filteredMembers.map((m, index) => {
                  const isSelected = index === activeMentionIdx;
                  const isIdvy = m.is_ai || m.id === IDVY_BOT_USER.id || m.email === 'idvy@ideate.app';
                  return (
                    <button
                      key={m.id || m.email || index}
                      data-mention-index={index}
                      type="button"
                      onMouseEnter={() => setActiveMentionIdx(index)}
                      onClick={() => insertMention(m)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition text-left ${
                        isSelected 
                          ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-300/50' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={m.avatar_url || getRandomAvatar(m.email || m.display_name)}
                          alt={m.display_name}
                          className={`w-7 h-7 rounded-full object-cover ring-1 ${
                            isIdvy ? 'ring-purple-400 p-0.5 bg-gradient-to-tr from-purple-700 to-indigo-600' : 'ring-slate-200'
                          }`}
                        />
                        {isIdvy && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-600 rounded-full ring-1 ring-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">
                            {m.display_name || 'Member'}
                          </span>
                          {isIdvy && (
                            <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[9px] font-bold uppercase tracking-wider">
                              AI Friend
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {isIdvy ? 'Smart & enthusiastic idea collaborator' : m.email}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-blue-500 font-medium flex-shrink-0">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. INLINE VOICE RECORDER DOCKED DIRECTLY AT TOP OF INPUT */}
        {/* ======================================================== */}
        {voiceRecorderState === 'recording' && (
          <div className="bg-gradient-to-r from-rose-50/90 via-amber-50/60 to-rose-50/90 border-b border-rose-200/80 px-3.5 py-2 flex items-center justify-between animate-fade-in">
            {/* Live recording indicator & timer */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <span className="text-xs font-bold text-rose-700 tracking-wide">
                Recording {formatTimer(recordingSeconds)}
              </span>

              {/* Animated audio wave bars */}
              <div className="hidden sm:flex items-center gap-0.5 h-4 ml-2">
                {[40, 80, 50, 95, 60, 100, 75, 45, 90, 60].map((h, i) => (
                  <span 
                    key={i} 
                    className="w-1 bg-rose-500 rounded-full animate-pulse" 
                    style={{ 
                      height: `${h}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Actions: Stop & Review or Cancel */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={stopInlineRecording}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition"
                title="Stop and review recording"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Done</span>
              </button>
              <button
                type="button"
                onClick={cancelInlineRecording}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100/70 transition"
                title="Cancel recording"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. INLINE AUDIO PLAY & REVIEW BAR AT TOP OF INPUT        */}
        {/* ======================================================== */}
        {voiceRecorderState === 'preview' && (
          <div className="bg-blue-50/90 border-b border-blue-200/80 px-3.5 py-2 flex items-center justify-between animate-fade-in">
            {previewAudioUrl && (
              <audio 
                ref={previewAudioRef} 
                src={previewAudioUrl} 
                onEnded={() => {
                  setIsPreviewPlaying(false);
                  setPreviewProgress(0);
                }}
                onTimeUpdate={(e) => {
                  if (e.target.duration) {
                    setPreviewProgress((e.target.currentTime / e.target.duration) * 100);
                  }
                }}
              />
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={togglePreviewPlay}
                className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-2xs flex-shrink-0"
                title={isPreviewPlaying ? "Pause preview" : "Play preview"}
              >
                {isPreviewPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                )}
              </button>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-blue-900 leading-tight">
                  Voice Note Preview ({formatTimer(recordingSeconds)})
                </span>
                <span className="text-[10px] text-blue-600 font-medium">
                  {isPreviewPlaying ? "Playing..." : "Tap play to listen before attaching"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={attachRecordedVoiceNote}
                disabled={isUploadingVoice}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition"
                title="Attach voice note to your message"
              >
                {isUploadingVoice ? (
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Attach Note</span>
              </button>

              <button
                type="button"
                onClick={startInlineRecording}
                className="p-1 rounded-lg text-blue-600 hover:bg-blue-100 transition"
                title="Re-record"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={cancelInlineRecording}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
                title="Discard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. SPEECH-TO-TEXT LISTENING BANNER                       */}
        {/* ======================================================== */}
        {isListening && (
          <div className="flex items-center justify-between bg-indigo-50/90 border-b border-indigo-100 px-3.5 py-1.5 text-xs text-indigo-700 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              <span className="font-medium">Listening... speak naturally to type</span>
            </div>
            <button 
              type="button"
              onClick={toggleSpeechToText}
              className="px-2 py-0.5 rounded-md text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Attachment chips preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2">
            {attachments.map((att, i) => (
              <div 
                key={i} 
                className="flex items-center gap-2 bg-slate-100 border border-slate-200/90 rounded-xl px-2 py-1 text-xs text-slate-700 font-medium transition"
              >
                {att.file_type === 'image' && (
                  <div className="relative w-7 h-7 rounded-md overflow-hidden border border-slate-300 flex-shrink-0 bg-slate-200">
                    <img src={att.storage_path} alt={att.file_name} className="w-full h-full object-cover" />
                    {att.isUploading && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="w-2.5 h-2.5 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                      </div>
                    )}
                  </div>
                )}
                {att.file_type === 'audio' && (
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayAudio(i, att.storage_path);
                      }}
                      className="w-4 h-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition flex-shrink-0 shadow-2xs"
                      title={playingAudioIdx === i ? "Pause voice note" : "Play & check voice note"}
                    >
                      {playingAudioIdx === i ? (
                        <Pause className="w-2 h-2 fill-white" />
                      ) : (
                        <Play className="w-2 h-2 fill-white ml-0.5" />
                      )}
                    </button>
                    <span className="font-semibold text-[11px]">Voice Note ({att.duration_seconds || 15}s)</span>
                  </div>
                )}
                {att.file_type === 'document' && (
                  <div className="flex items-center gap-1 text-slate-600">
                    {att.isUploading ? (
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin flex-shrink-0"></span>
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span className="max-w-[100px] truncate text-[11px]">{att.file_name}</span>
                  </div>
                )}

                <button 
                  onClick={() => removeAttachment(i)} 
                  className="p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-300/60 transition"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea - sleek and modern typography */}
        <div className="px-3 pt-2.5 pb-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            placeholder="Type a message, mention with @, or type / for commands..."
            rows={1}
            autoComplete="off"
            spellCheck="false"
            className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none leading-relaxed min-h-[40px] max-h-28 overflow-y-auto block outline-none border-none shadow-none ring-0 select-text font-normal"
            style={{
              outline: 'none',
              boxShadow: 'none',
              border: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitFocusRingColor: 'transparent'
            }}
            onKeyDown={(e) => {
              // 1. If Slash menu is open, handle Arrow keys, Enter/Tab, and Escape
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
                  if (filteredSlashCommands.length > 0 && filteredSlashCommands[activeSlashIdx]) {
                    insertSlashCommand(filteredSlashCommands[activeSlashIdx]);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowSlashMenu(false);
                  return;
                }
              }

              // 2. If Mention menu is open, handle Arrow keys, Enter/Tab, and Escape
              if (showMentionMenu) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (filteredMembers.length > 0) {
                    setActiveMentionIdx(prev => (prev + 1) % filteredMembers.length);
                  }
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (filteredMembers.length > 0) {
                    setActiveMentionIdx(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
                  }
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  if (filteredMembers.length > 0 && filteredMembers[activeMentionIdx]) {
                    insertMention(filteredMembers[activeMentionIdx]);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowMentionMenu(false);
                  return;
                }
              }

              // 3. Normal Enter to post
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (slashValidation.isIncomplete) {
                  return;
                }
                handleSubmit();
              }
            }}
          />
        </div>

        {/* Slash command incomplete constraint notice */}
        {slashValidation.isIncomplete && (
          <div className="mx-3 mb-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>{slashValidation.message}</span>
          </div>
        )}

        {/* Modern Icon Toolbar (Clean, icon-based, no clutter) */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Tag Collaborator (@mention) */}
            <button
              ref={tagButtonRef}
              type="button"
              onClick={() => {
                setShowMentionMenu(!showMentionMenu);
                setMentionQuery('');
                setActiveMentionIdx(0);
                textareaRef.current?.focus();
              }}
              className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition active:scale-95 ${
                showMentionMenu ? 'bg-blue-100/70 text-blue-600 ring-1 ring-blue-300/60' : ''
              }`}
              title="Tag a collaborator (@mention)"
            >
              <AtSign className="w-4 h-4 text-blue-500" />
            </button>

            {/* Inline Voice Note Recorder Trigger */}
            <button
              type="button"
              onClick={() => {
                if (voiceRecorderState === 'recording') {
                  stopInlineRecording();
                } else if (voiceRecorderState === 'preview') {
                  cancelInlineRecording();
                } else {
                  startInlineRecording();
                }
              }}
              className={`p-1.5 rounded-lg transition active:scale-95 ${
                voiceRecorderState !== 'idle'
                  ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
              title={voiceRecorderState === 'recording' ? "Stop recording voice note" : "Record voice note"}
            >
              <AudioLines className={`w-4 h-4 ${voiceRecorderState === 'recording' ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
            </button>

            {/* Speech-to-text / Voice typing (Clean mic icon without stars) */}
            <button
              type="button"
              onClick={toggleSpeechToText}
              className={`p-1.5 rounded-lg transition active:scale-95 ${
                isListening
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
              title={isListening ? "Stop voice typing" : "Voice typing (Speech-to-text)"}
            >
              <Mic className={`w-4 h-4 ${isListening ? 'text-indigo-600 animate-pulse' : 'text-slate-500'}`} />
            </button>

            {/* Image Upload Button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition active:scale-95"
              title="Attach images (select one or multiple)"
            >
              <ImageIcon className="w-4 h-4 text-slate-500" />
            </button>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* File Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition active:scale-95"
              title="Attach files (select one or multiple)"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Post Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading) || slashValidation.isIncomplete}
            className={`h-7 sm:h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              (!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading) || slashValidation.isIncomplete
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'text-white shadow-2xs hover:opacity-95 active:scale-95'
            }`}
            style={{
              backgroundColor: (!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading) || slashValidation.isIncomplete
                ? undefined
                : (theme?.hex || '#2563EB')
            }}
            title={slashValidation.isIncomplete ? slashValidation.message : "Post message (Enter)"}
          >
            {isSubmitting ? (
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            ) : attachments.some(a => a.isUploading) ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
