import React, { useEffect } from 'react';
import { 
  Lock, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  X 
} from 'lucide-react';

export default function NoticeModal({
  isOpen,
  onClose,
  title = 'Information',
  message = '',
  type = 'info', // 'lock' | 'warning' | 'info' | 'ai' | 'success'
  actionLabel = 'Got it',
  onAction = null
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Icon & Theme Configuration
  const getThemeConfig = () => {
    switch (type) {
      case 'lock':
        return {
          icon: <Lock className="w-6 h-6 text-amber-600" />,
          badgeBg: 'bg-amber-100 ring-4 ring-amber-50',
          buttonBg: 'bg-slate-900 hover:bg-slate-800 text-white'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
          badgeBg: 'bg-rose-100 ring-4 ring-rose-50',
          buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white'
        };
      case 'ai':
        return {
          icon: <Sparkles className="w-6 h-6 text-purple-600 fill-purple-100" />,
          badgeBg: 'bg-purple-100 ring-4 ring-purple-50',
          buttonBg: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          badgeBg: 'bg-emerald-100 ring-4 ring-emerald-50',
          buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          badgeBg: 'bg-blue-100 ring-4 ring-blue-50',
          buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
    }
  };

  const config = getThemeConfig();

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-in text-center flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X Button in top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Themed Icon Badge */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${config.badgeBg}`}>
          {config.icon}
        </div>

        {/* Modal Title */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h3>

        {/* Modal Message Content */}
        <div className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm whitespace-pre-wrap">
          {message}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAction}
          className={`w-full mt-6 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 shadow-sm active:scale-98 ${config.buttonBg}`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
