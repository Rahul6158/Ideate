import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export default function AudioPlayer({ src, duration = 42 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Generate deterministic bar heights for waveform
  const barHeights = [
    12, 18, 28, 14, 20, 32, 24, 16, 26, 36, 
    22, 14, 30, 24, 18, 28, 34, 20, 16, 22, 
    30, 26, 18, 24, 14, 20, 16, 12, 22, 14
  ];

  const totalDuration = duration || 42;

  const togglePlay = () => {
    if (audioRef.current && src && !src.startsWith('mock/')) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        clearInterval(timerRef.current);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          // Fallback simulation
          simulatePlay();
        });
      }
    } else {
      // Audio simulation
      if (isPlaying) {
        setIsPlaying(false);
        clearInterval(timerRef.current);
      } else {
        simulatePlay();
      }
    }
  };

  const simulatePlay = () => {
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= totalDuration) {
          clearInterval(timerRef.current);
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="flex items-center gap-3.5 bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl p-2.5 px-4 w-full max-w-md transition-all">
      {src && !src.startsWith('mock/') && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(Math.floor(audioRef.current.currentTime));
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      {/* Play/Pause circular blue button */}
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 transition-all flex-shrink-0"
        title={isPlaying ? "Pause" : "Play voice note"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-white" />
        ) : (
          <Play className="w-4 h-4 fill-white ml-0.5" />
        )}
      </button>

      {/* Interactive Waveform Display */}
      <div 
        className="flex-1 flex items-center gap-[3px] h-9 cursor-pointer select-none"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickPos = (e.clientX - rect.left) / rect.width;
          const newTime = Math.floor(clickPos * totalDuration);
          setCurrentTime(newTime);
          if (audioRef.current && audioRef.current.duration) {
            audioRef.current.currentTime = newTime;
          }
        }}
      >
        {barHeights.map((h, i) => {
          const barPercent = (i / barHeights.length) * 100;
          const isPassed = barPercent <= progressPercent;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-150 ${
                isPassed ? 'bg-blue-600' : 'bg-slate-300'
              } ${isPlaying && isPassed ? 'scale-y-110' : ''}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-xs font-medium text-slate-500 tabular-nums flex-shrink-0">
        {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
      </span>
    </div>
  );
}
