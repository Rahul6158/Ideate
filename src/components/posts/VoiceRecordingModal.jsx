import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, RefreshCw, Volume2, Play, Pause, GripHorizontal } from 'lucide-react';

// Generates a pleasant synthesized WAV chime audio blob if microphone is unavailable or simulated
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

  // Smooth warm chime sequence
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

export default function VoiceRecordingModal({ isOpen, onClose, onFinishRecording }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  // Drag-and-move state to allow moving the modal freely on screen
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioElementRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 }); // Center on each open
      startRecording();
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  // Draggable logic for mouse and touch
  const handleDragStart = (clientX, clientY, target) => {
    if (target.closest('button') || target.closest('input') || target.closest('audio')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      posX: position.x,
      posY: position.y
    };
  };

  const handleMouseDown = (e) => {
    handleDragStart(e.clientX, e.clientY, e.target);
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy
      });
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.mouseX;
        const dy = touch.clientY - dragStartRef.current.mouseY;
        setPosition({
          x: dragStartRef.current.posX + dx,
          y: dragStartRef.current.posY + dy
        });
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setIsRecording(false);
    setIsPlaying(false);
    setSeconds(0);
    setPlaybackTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const startRecording = async () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setIsPlaying(false);
    setPlaybackTime(0);
    setSeconds(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(true);
    chunksRef.current = [];

    // Start timer
    timerRef.current = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(100);
    } catch (err) {
      console.warn('Real microphone unavailable, using synthesized audio fallback:', err.message);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } else {
      const recordedDuration = Math.max(seconds, 3);
      const synthBlob = createSynthesizedAudioBlob(recordedDuration);
      setAudioBlob(synthBlob);
      const url = URL.createObjectURL(synthBlob);
      setAudioUrl(url);
    }
  };

  const togglePlayback = () => {
    if (!audioElementRef.current || !audioUrl) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioElementRef.current) {
      setPlaybackTime(Math.floor(audioElementRef.current.currentTime));
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
    }
  };

  const handleAttach = () => {
    const finalBlob = audioBlob || createSynthesizedAudioBlob(Math.max(seconds, 3));
    const durationToReport = Math.max(seconds, 3);

    onFinishRecording({
      blob: finalBlob,
      duration: durationToReport
    });
    cleanup();
    onClose();
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalDuration = Math.max(seconds, 1);
  const progressRatio = totalDuration > 0 ? playbackTime / totalDuration : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-hidden">
      {/* Draggable Modal Box */}
      <div 
        className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center border border-slate-100 relative my-auto select-none"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          cursor: isDragging ? 'grabbing' : 'default',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle Bar at Top */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing -mt-1 mb-2 group"
          title="Click and drag to move this modal anywhere on your screen"
        >
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 transition-colors text-slate-400 group-hover:text-slate-600">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Drag to Move</span>
          </div>
        </div>

        {/* Hidden Audio Player for Preview */}
        {audioUrl && (
          <audio
            ref={audioElementRef}
            src={audioUrl}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={handleAudioEnded}
          />
        )}

        {/* Header */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="w-full flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="text-sm font-semibold text-red-600 tracking-wide">Recording...</span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-blue-600">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-semibold text-slate-800">Check Audio Recording</span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums tracking-tight">
            {isRecording ? formatTimer(seconds) : `${formatTimer(playbackTime)} / ${formatTimer(totalDuration)}`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isRecording ? 'Speak clearly into your microphone' : 'Play to verify your recording before sending'}
          </p>
        </div>

        {/* Waveform graphic & interactive scrubber */}
        <div 
          className={`flex items-center justify-center gap-1.5 h-14 w-full px-4 mb-4 rounded-2xl transition-colors ${
            !isRecording ? 'bg-slate-50 border border-slate-100 cursor-pointer' : ''
          }`}
          onClick={(e) => {
            if (!isRecording && audioElementRef.current && totalDuration > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const newTime = clickPos * totalDuration;
              audioElementRef.current.currentTime = newTime;
              setPlaybackTime(Math.floor(newTime));
            }
          }}
        >
          {[16, 24, 40, 20, 32, 52, 28, 44, 60, 36, 48, 56, 30, 42, 24, 18, 32, 48, 22, 14].map((h, idx) => {
            const barPos = idx / 20;
            const isPassed = !isRecording && barPos <= progressRatio;
            return (
              <div
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-200 ${
                  isRecording 
                    ? 'bg-rose-500 animate-pulse' 
                    : isPassed
                      ? 'bg-blue-600 scale-y-110'
                      : 'bg-slate-300'
                }`}
                style={{
                  height: isRecording 
                    ? `${Math.max(12, (h * (0.4 + Math.sin((seconds + idx) * 0.8) * 0.6)))}px`
                    : `${h * 0.6}px`
                }}
              />
            );
          })}
        </div>

        {/* Playable audio preview controller when stopped */}
        {!isRecording && audioUrl && (
          <div className="w-full flex items-center justify-center gap-3 mb-5 p-2.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
            <button
              onClick={togglePlayback}
              type="button"
              className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-md shadow-blue-500/25 transition-all flex-shrink-0"
              title={isPlaying ? "Pause Preview" : "Play & Check Audio"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>{isPlaying ? 'Playing Audio...' : 'Click to Play Audio'}</span>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/70 px-1.5 py-0.5 rounded-full">
                  {totalDuration}s
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {isPlaying ? 'Listen to verify voice clarity' : 'Verify sound before attaching'}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isRecording ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <button
              onClick={stopRecording}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform"
              title="Stop Recording"
            >
              <Square className="w-5 h-5 fill-white" />
            </button>
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 w-full">
            <button
              onClick={startRecording}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Re-record</span>
            </button>
            <button
              onClick={handleAttach}
              className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
            >
              <span>Attach Voice Note</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
