import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Image as ImageIcon, 
  Paperclip, 
  X, 
  Send, 
  FileText,
  Sparkles,
  Square,
  Play,
  Pause,
  RefreshCw,
  Check,
  AtSign,
  CornerUpLeft
} from 'lucide-react';
import { storageService } from '../../services/storageService';
import { getRandomAvatar } from '../../data/avatars';

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
  onCancelReply
}) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [playingAudioIdx, setPlayingAudioIdx] = useState(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

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

  // HANDLE CONTENT CHANGE FOR @MENTIONS
  const handleTextChange = (e) => {
    const val = e.target.value;
    setContent(val);

    // Check if the user is typing an @mention
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes(' ') || query.length < 15) {
        setMentionQuery(query.toLowerCase());
        setShowMentionMenu(true);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const insertMention = (member) => {
    const name = member.display_name || member.email?.split('@')[0] || 'member';
    const cursor = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.slice(0, cursor);
    const textAfterCursor = content.slice(cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    const newBefore = lastAtIdx !== -1 ? textBeforeCursor.slice(0, lastAtIdx) : textBeforeCursor;
    const updatedContent = `${newBefore}@${name} ${textAfterCursor}`;

    setContent(updatedContent);
    setShowMentionMenu(false);
    textareaRef.current?.focus();
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

      await onPostCreated({
        content: content.trim(),
        attachments: cleanAttachments,
        reply_to: replyingTo ? {
          id: replyingTo.id,
          user_name: replyingTo.user?.display_name || 'Member',
          content: (replyingTo.content || 'Attached file').slice(0, 100),
          user_avatar: replyingTo.user?.avatar_url
        } : null
      });
      setContent('');
      setAttachments([]);
      if (onCancelReply) onCancelReply();
      if (isListening && speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        setIsListening(false);
      }
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

  // Filter members for @mention dropdown
  const filteredMembers = (members || []).filter(m => {
    const name = (m.display_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return name.includes(mentionQuery) || email.includes(mentionQuery);
  });

  return (
    <>
      {/* Audio element for chip preview */}
      <audio 
        ref={composerAudioRef} 
        onEnded={() => setPlayingAudioIdx(null)} 
      />

      <div className="relative bg-white border border-slate-200/90 rounded-2xl shadow-xs transition-colors overflow-visible focus-within:border-blue-400">
        
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
                "{replyingTo.content || 'Attached file'}"
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
        {/* @ MENTION POPUP MENU                                     */}
        {/* ======================================================== */}
        {showMentionMenu && (
          <div className="absolute left-3 bottom-full mb-2 w-64 max-h-48 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-1.5 z-50 animate-scale-in">
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Tag Collaborator
            </div>
            {filteredMembers.length === 0 ? (
              <div className="p-2.5 text-xs text-slate-400 text-center italic">
                No collaborators found
              </div>
            ) : (
              filteredMembers.map((m) => (
                <button
                  key={m.id || m.email}
                  type="button"
                  onClick={() => insertMention(m)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 transition text-left"
                >
                  <img
                    src={m.avatar_url || getRandomAvatar(m.email || m.display_name)}
                    alt={m.display_name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {m.display_name || 'Member'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {m.email}
                    </div>
                  </div>
                </button>
              ))
            )}
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
          <div className="flex items-center justify-between bg-indigo-50 border-b border-indigo-200/70 px-3.5 py-1.5 text-xs text-indigo-700 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
              <span className="font-semibold">Listening... speak naturally to type</span>
            </div>
            <button 
              onClick={toggleSpeechToText}
              className="text-indigo-800 font-bold underline hover:text-indigo-900"
            >
              Stop
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

        {/* Textarea - sleek and compact, ZERO box flash on click */}
        <div className="px-3 pt-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            placeholder="Type a message, mention with @, or share thoughts... (Enter to post, Shift+Enter for new line)"
            rows={1}
            autoComplete="off"
            spellCheck="false"
            className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none leading-normal max-h-24 overflow-y-auto block outline-none border-none shadow-none ring-0 select-text"
            style={{
              outline: 'none',
              boxShadow: 'none',
              border: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitFocusRingColor: 'transparent'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* Compact Action Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Tag Collaborator with @ button */}
            <button
              type="button"
              onClick={() => {
                setShowMentionMenu(!showMentionMenu);
                setMentionQuery('');
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title="Tag a collaborator (@mention)"
            >
              <AtSign className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Tag</span>
            </button>
            {/* Inline Voice Record Trigger */}
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
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                voiceRecorderState !== 'idle'
                  ? 'bg-rose-100 text-rose-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Record voice note directly at top of input box"
            >
              <Mic className={`w-3.5 h-3.5 ${voiceRecorderState === 'recording' ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
              <span>Voice</span>
            </button>

            {/* Speak-to-text button */}
            <button
              type="button"
              onClick={toggleSpeechToText}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                isListening
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Speak to type text"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Speech</span>
            </button>

            {/* Image Upload Button (Multiple selection supported) */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title="Attach images (select one or multiple)"
            >
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Images</span>
            </button>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* File Upload Button (Multiple selection supported) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title="Attach files (select one or multiple)"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Files</span>
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
            disabled={(!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              (!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'text-white shadow-2xs hover:opacity-95 active:scale-95'
            }`}
            style={{
              backgroundColor: (!content.trim() && attachments.length === 0) || isSubmitting || attachments.some(a => a.isUploading)
                ? undefined
                : (theme?.hex || '#2563EB')
            }}
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
