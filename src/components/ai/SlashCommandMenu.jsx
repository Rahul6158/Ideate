import React, { useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Terminal, 
  HelpCircle, 
  FileText, 
  Search, 
  Lightbulb,
  CheckSquare,
  Lock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { IDVY_SLASH_COMMANDS } from '../../services/aiService';

const CATEGORY_ICONS = {
  Summary: FileText,
  Strategy: Lightbulb,
  Organization: CheckSquare,
  Ideation: Sparkles,
  Research: Search,
  Private: Lock,
  Info: HelpCircle
};

export default function SlashCommandMenu({ 
  query = '', 
  activeIndex = 0,
  onSelectCommand,
  onHoverIndex 
}) {
  const containerRef = useRef(null);
  const cleanQuery = (query || '').replace(/^[\/.]/, '').toLowerCase();

  const filteredCommands = IDVY_SLASH_COMMANDS.filter(cmd => 
    cmd.command.toLowerCase().includes(cleanQuery) || 
    cmd.description.toLowerCase().includes(cleanQuery) ||
    cmd.category.toLowerCase().includes(cleanQuery) ||
    cmd.syntax.toLowerCase().includes(cleanQuery)
  );

  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector(`[data-slash-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div 
      ref={containerRef}
      className="absolute left-3 bottom-full mb-2 w-80 sm:w-96 max-h-72 overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-purple-200/90 p-2 z-50 animate-scale-in"
    >
      <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-900 uppercase tracking-wider">
          <Terminal className="w-3.5 h-3.5 text-purple-600" />
          <span>Idvy Slash Commands</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">↑↓ navigate · ↵ select · esc</span>
      </div>

      {filteredCommands.length === 0 ? (
        <div className="p-3 text-xs text-slate-400 text-center italic">
          No matching slash commands found
        </div>
      ) : (
        <div className="space-y-1">
          {filteredCommands.map((cmd, idx) => {
            const Icon = CATEGORY_ICONS[cmd.category] || Sparkles;
            const isSelected = idx === activeIndex;

            return (
              <button
                key={cmd.command}
                data-slash-index={idx}
                type="button"
                onMouseEnter={() => onHoverIndex && onHoverIndex(idx)}
                onClick={() => onSelectCommand(cmd)}
                className={`w-full flex items-start gap-2.5 p-2 rounded-xl transition text-left group ${
                  isSelected 
                    ? 'bg-purple-100/80 ring-1 ring-purple-300 text-purple-950' 
                    : 'hover:bg-purple-50/80 text-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition flex-shrink-0 mt-0.5 ${
                  isSelected ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 group-hover:bg-purple-200'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-mono font-bold text-purple-950 group-hover:text-purple-700">
                      {cmd.syntax}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider ${
                      cmd.category === 'Private'
                        ? 'bg-amber-100 text-amber-800'
                        : isSelected 
                          ? 'bg-purple-200 text-purple-800' 
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {cmd.category}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 font-medium mt-0.5 leading-snug">
                    {cmd.description}
                  </div>

                  {/* Clear parameter requirement & constraint explanation */}
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    {cmd.requiresParam ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                        <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 text-amber-600" />
                        <span>Requires {cmd.paramName || 'argument'} after command</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                        <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0 text-emerald-600" />
                        <span>Runs on full idea context (no arguments needed)</span>
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <span className="text-[11px] text-purple-600 font-bold self-center flex-shrink-0">
                    ↵
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
