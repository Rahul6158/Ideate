import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, Compass, Sparkles, Send, ArrowRight, UserCheck, Shield } from 'lucide-react';
import { memberService } from '../../services/memberService';
import { ideaService } from '../../services/ideaService';
import { useAuth } from '../../context/AuthContext';
import { getRandomAvatar } from '../../data/avatars';
import { getIdeaTheme } from '../../data/themePalettes';

export default function JoinIdeaModal({ isOpen, onClose, onJoined }) {
  const { currentUser } = useAuth();
  const [ideaId, setIdeaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewIdea, setPreviewIdea] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIdeaId('');
      setPreviewIdea(null);
      setError('');
      setSuccessMessage('');
      setLoading(false);
      setPreviewLoading(false);
    }
  }, [isOpen]);

  // Live lookup of idea when a potential UUID / ID is entered
  useEffect(() => {
    const clean = ideaId.trim();
    if (!clean || clean.length < 8) {
      setPreviewIdea(null);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setError('');
      try {
        const found = await ideaService.getIdeaById(clean, currentUser?.id);
        if (found) {
          setPreviewIdea(found);
          if (found.owner_id === currentUser?.id) {
            setError('You are the author of this idea space.');
          } else if (found.is_shared) {
            setError('You are already an active collaborator on this idea.');
          } else {
            setError('');
          }
        } else {
          setPreviewIdea(null);
        }
      } catch (err) {
        setPreviewIdea(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [ideaId, currentUser?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const clean = ideaId.trim();
    if (!clean) {
      setError('Please enter a valid Idea ID.');
      return;
    }

    if (!currentUser?.id) {
      setError('You must be logged in to join an idea.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await memberService.requestToJoin(clean, currentUser);
      setSuccessMessage(`Join request sent for "${res.idea?.title || 'Idea Space'}"! The creator will review and accept your request.`);
      setTimeout(() => {
        if (onJoined) onJoined(res.idea);
        onClose();
      }, 2200);
    } catch (err) {
      setError(err.message || 'Failed to submit join request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const previewTheme = previewIdea ? getIdeaTheme(previewIdea.color_theme) : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs flex-shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Join an Idea Space
              </h3>
              <p className="text-xs text-slate-500">
                Enter an Idea ID to request access from the creator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs animate-bounce">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Request Sent!</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Idea ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ideaId}
                  onChange={(e) => setIdeaId(e.target.value)}
                  placeholder="Paste Idea UUID (e.g. 01a955d4-...)"
                  className="w-full pl-3.5 pr-14 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setIdeaId(text.trim());
                    } catch (_) {}
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  Paste
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ask the idea creator or admin to copy the Idea ID from their workspace settings.
              </p>
            </div>

            {/* Live Idea Preview if detected */}
            {previewLoading && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center animate-pulse">
                Looking up idea details...
              </div>
            )}

            {previewIdea && !previewLoading && (
              <div 
                className="p-3.5 rounded-2xl border transition-all animate-fade-in"
                style={{
                  backgroundColor: previewTheme?.lightHex || '#f8fafc',
                  borderColor: previewTheme?.borderHex || '#e2e8f0'
                }}
              >
                <div className="flex items-center gap-3">
                  {previewIdea.cover_url ? (
                    <img 
                      src={previewIdea.cover_url} 
                      alt={previewIdea.title} 
                      className="w-12 h-12 rounded-xl object-cover shadow-xs flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-xs flex-shrink-0"
                      style={{ backgroundColor: previewTheme?.hex || '#3b82f6' }}
                    >
                      {previewIdea.title ? previewIdea.title.charAt(0).toUpperCase() : '💡'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {previewIdea.title}
                    </h4>
                    {previewIdea.description && (
                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {previewIdea.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200/60 shadow-2xs">
                        Author: {previewIdea.owner?.display_name || previewIdea.owner?.email?.split('@')[0] || 'Member'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !ideaId.trim() || !!(previewIdea && (previewIdea.owner_id === currentUser?.id || previewIdea.is_shared))}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Request to Join</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
