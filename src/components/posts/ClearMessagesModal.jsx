import React, { useState } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

export default function ClearMessagesModal({ isOpen, onClose, onConfirm, isClearing = false }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for clearing your messages.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const presetReasons = [
    'Sent by mistake / drafts',
    'Project restarted with new scope',
    'Cleaning up discussion history',
    'Outdated specifications or questions'
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Clear All My Messages
              </h3>
              <p className="text-xs text-slate-500">
                Permanently remove your messages from this idea
              </p>
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

        <div className="mb-4 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            All posts you wrote in this idea will be deleted. A system notice with your reason will be posted in the chat so other collaborators understand why.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for clearing (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Sent drafts by mistake, updating with final proposal..."
              rows={3}
              required
              className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
            />
            {error && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>
            )}
          </div>

          {/* Quick preset suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Or pick a quick reason:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presetReasons.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setReason(p);
                    if (error) setError('');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs transition border ${
                    reason === p 
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isClearing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isClearing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm shadow-rose-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isClearing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm & Clear Messages</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
