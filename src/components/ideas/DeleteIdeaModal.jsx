import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  X, 
  Trash2, 
  Heart, 
  HelpCircle, 
  Check, 
  RotateCcw,
  Sparkles,
  Users,
  MessageSquare
} from 'lucide-react';

export default function DeleteIdeaModal({ isOpen, onClose, idea, onConfirmDelete }) {
  const [puzzle, setPuzzle] = useState({ a: 0, b: 0, answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Generate a fresh random puzzle when modal opens or on refresh
  const generatePuzzle = () => {
    const a = Math.floor(Math.random() * 25) + 12;
    const b = Math.floor(Math.random() * 25) + 8;
    setPuzzle({ a, b, answer: a + b });
    setUserInput('');
  };

  useEffect(() => {
    if (isOpen) {
      generatePuzzle();
      setIsDeleting(false);
    }
  }, [isOpen, idea?.id]);

  if (!isOpen || !idea) return null;

  const isSolved = parseInt(userInput.trim(), 10) === puzzle.answer;

  const handleDelete = async () => {
    if (!isSolved) return;
    setIsDeleting(true);
    try {
      // Ensure the while-deleting animation plays smoothly
      await Promise.all([
        onConfirmDelete(idea.id),
        new Promise(resolve => setTimeout(resolve, 1400))
      ]);
      onClose();
    } catch (err) {
      alert('Failed to delete idea: ' + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 animate-slide-up overflow-hidden relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Badge & Close */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${
              isDeleting 
                ? 'bg-rose-50 border border-rose-200 text-rose-600 animate-spin'
                : userInput.trim().length > 0 
                  ? 'bg-pink-50 border border-pink-200 text-pink-600 animate-pulse'
                  : 'bg-amber-50 border border-amber-200 text-amber-600 animate-bounce-subtle'
            }`}>
              {isDeleting ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isDeleting 
                  ? 'bg-rose-100 text-rose-700'
                  : userInput.trim().length > 0 
                    ? 'bg-pink-100 text-pink-700'
                    : 'bg-amber-100 text-amber-700'
              }`}>
                {isDeleting ? 'Deleting In Progress' : userInput.trim().length > 0 ? 'Wait... Reconsider!' : 'Destructive Action'}
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {isDeleting 
                  ? 'Saying Goodbye... 🗑️' 
                  : userInput.trim().length > 0 
                    ? 'Please Don’t Delete Me! 🥺' 
                    : 'Wait, Think Again! 💡'}
              </h2>
            </div>
          </div>

          {!isDeleting && (
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic GIF Display based on deletion state */}
        <div className="flex flex-col items-center justify-center p-3 mb-4 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/70 shadow-2xs">
          <div className="relative w-48 h-36 flex items-center justify-center overflow-hidden rounded-xl bg-white/80 shadow-2xs">
            {isDeleting ? (
              <img 
                key="while-deleting"
                src="/while-deleting.gif" 
                alt="Deleting in progress" 
                className="w-full h-full object-contain animate-fade-in"
              />
            ) : userInput.trim().length > 0 ? (
              <img 
                key="please"
                src="/please.gif" 
                alt="Please don't delete" 
                className="w-full h-full object-contain animate-fade-in"
              />
            ) : (
              <img 
                key="think-again"
                src="/think-again.gif" 
                alt="Think again" 
                className="w-full h-full object-contain animate-fade-in"
              />
            )}
          </div>
          
          <p className="text-xs font-semibold text-slate-700 mt-2 text-center">
            {isDeleting 
              ? 'Wiping idea board, discussions, and attachments...' 
              : userInput.trim().length > 0 
                ? 'Please reconsider! Are you sure you want to solve this?' 
                : 'Think again! Don’t let this spark go out.'}
          </p>
        </div>

        {/* Idea Preview Card */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4">
          {idea.cover_url && (
            <img 
              src={idea.cover_url} 
              alt={idea.title} 
              className="w-14 h-11 rounded-xl object-cover border border-slate-200 shadow-2xs flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {idea.title}
            </h4>
            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-400" />
                <span>{idea.members_count || 1} members</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                <span>{idea.posts_count || 0} posts</span>
              </span>
            </div>
          </div>
        </div>

        {/* Puzzle / Challenge Box */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-inner mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Safety Puzzle: Solve to Unlock Deletion</span>
            </div>
            <button
              type="button"
              onClick={generatePuzzle}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition"
              title="Get another puzzle"
            >
              <RotateCcw className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-base font-bold text-white tracking-widest flex items-center gap-2">
              <span>{puzzle.a} + {puzzle.b} = ?</span>
            </div>

            <div className="relative flex-1">
              <input
                type="number"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter sum"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-800 border text-sm font-bold text-white placeholder:text-slate-500 outline-none transition ${
                  isSolved 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-400' 
                    : 'border-slate-700 focus:border-amber-400'
                }`}
                autoFocus
              />
              {isSolved && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            {isSolved 
              ? '✓ Correct answer. Deletion is now unlocked.' 
              : 'Calculate the sum above to enable the delete button.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {/* Recommended Keep button */}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
          >
            <Heart className="w-4 h-4 fill-current text-white/80" />
            <span>Keep My Idea</span>
          </button>

          {/* Delete button (only unlocked when puzzle solved) */}
          <button
            type="button"
            disabled={!isSolved || isDeleting}
            onClick={handleDelete}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
              isSolved && !isDeleting
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20 cursor-pointer animate-fade-in'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            {isDeleting ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
