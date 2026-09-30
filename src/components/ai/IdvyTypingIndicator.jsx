import React from 'react';
import { Sparkles } from 'lucide-react';

export default function IdvyTypingIndicator({ status = 'Idvy is typing a response...' }) {
  return (
    <div className="flex items-start gap-3 sm:gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/70 shadow-2xs animate-fade-in my-2 max-w-lg">
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-purple-400/80 p-0.5 bg-gradient-to-tr from-purple-700 to-indigo-600">
          <img src="/avatars/idvy-avatar.avif" alt="Idvy" className="w-full h-full rounded-full object-cover" />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-600 text-white ring-2 ring-white">
          <Sparkles className="w-2 h-2" />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-bold text-purple-900 tracking-tight flex items-center gap-1">
            Idvy
            <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-purple-700 font-medium">
          <span>{status}</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
