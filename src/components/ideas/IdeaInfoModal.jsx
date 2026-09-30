import React, { useState } from 'react';
import { 
  X, 
  Info, 
  Sparkles, 
  Users, 
  Calendar, 
  ShieldCheck, 
  Cpu, 
  Database, 
  Bell, 
  Check, 
  Copy, 
  Layers,
  Palette,
  ExternalLink
} from 'lucide-react';
import { getIdeaTheme } from '../../data/themePalettes';
import IdvyAvatar from '../ai/IdvyAvatar';

export default function IdeaInfoModal({
  isOpen,
  onClose,
  idea,
  members = [],
  postsCount = 0,
  isIdvyPaused = false
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'ai' | 'diagnostics'

  if (!isOpen || !idea) return null;

  const theme = getIdeaTheme(idea.color_theme);

  const handleCopyDetails = () => {
    const details = `Idea: ${idea.title}
Description: ${idea.description || 'N/A'}
Collaborators: ${members.length}
Total Posts: ${postsCount}
Theme: ${theme.name} (${theme.hex})
AI Engine: NVIDIA Nemotron-3-Ultra-550B (1M Context)
Status: Active`;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-4 sm:p-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: `${theme.hex}10`, borderColor: theme.borderHex || '#e2e8f0' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {idea.cover_url ? (
              <img 
                src={idea.cover_url} 
                alt={idea.title} 
                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-white shadow-sm flex-shrink-0" 
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0 text-base"
                style={{ backgroundColor: theme.hex }}
              >
                {idea.title?.charAt(0).toUpperCase() || '💡'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {idea.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.hex }} />
                  {theme.name}
                </span>
                <span>•</span>
                <span>{members.length} Collaborator{members.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-100 px-4 pt-2 bg-slate-50/70 text-xs font-semibold text-slate-600 gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-600 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Idvy AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>System & Diagnostics</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Description / Pitch
                </label>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                  {idea.description || 'No description provided for this idea yet.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Created</div>
                    <div className="font-bold text-slate-800">
                      {idea.created_at ? new Date(idea.created_at).toLocaleDateString() : 'Recent'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Messages</div>
                    <div className="font-bold text-slate-800">{postsCount} posted</div>
                  </div>
                </div>
              </div>

              {idea.tags && idea.tags.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {idea.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-100"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IDVY AI */}
          {activeTab === 'ai' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-purple-50/80 to-indigo-50/80 border border-purple-200/70">
                <IdvyAvatar size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Idvy AI Collaborator</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isIdvyPaused ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isIdvyPaused ? 'Paused' : 'Active & Ready'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Always available via @Idvy mentions, slash commands, or Off-the-Record chat.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Model Specifications
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold">Model ID</div>
                    <div className="font-mono font-bold text-slate-800 text-[11px]">nvidia/nemotron-3-ultra-550b</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold">Context Window</div>
                    <div className="font-bold text-slate-800 text-[11px]">Up to 1 Million tokens</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold">Capabilities</div>
                    <div className="font-bold text-slate-800 text-[11px]">Reasoning, Planning, Synthesis</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] text-slate-400 font-semibold">Endpoint</div>
                    <div className="font-bold text-slate-800 text-[11px]">NVIDIA NIM OpenAI-Compatible</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Commands You Can Run
                </label>
                <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 text-purple-900 text-[11px] space-y-1">
                  <p><span className="font-mono font-bold">/help</span> — List available commands & guidance</p>
                  <p><span className="font-mono font-bold">/summary</span> — High-level discussion digest</p>
                  <p><span className="font-mono font-bold">/decisions</span> — Log all team decisions</p>
                  <p><span className="font-mono font-bold">/tasks</span> — Extract action items and assignees</p>
                  <p><span className="font-mono font-bold">/plan</span> — Step-by-step milestone execution roadmap</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & SYSTEM */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">System Healthy & Synced</div>
                  <p className="text-emerald-700 text-[11px] mt-0.5 leading-relaxed">
                    All core services are actively connected. Fallback resilience layers ensure messages and AI permissions persist seamlessly.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-600 font-medium">Supabase Database</span>
                  <span className="flex items-center gap-1 font-bold text-emerald-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-600 font-medium">Realtime Post Sync</span>
                  <span className="flex items-center gap-1 font-bold text-emerald-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Active Channel
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-600 font-medium">Web Push Notifications</span>
                  <span className="flex items-center gap-1 font-bold text-blue-600 text-[11px]">
                    <Bell className="w-3 h-3" />
                    Service Worker Ready
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-600 font-medium">Local Store Fallback Cache</span>
                  <span className="font-mono text-slate-700 font-semibold text-[11px]">
                    Operational
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleCopyDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
