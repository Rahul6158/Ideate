import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  BellRing, 
  CheckCheck, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Mic, 
  FolderKanban, 
  MessageSquare, 
  Users, 
  ExternalLink,
  Check,
  Radio,
  Play
} from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { getSoundSettings, setSoundSettings, playNotificationSound } from '../utils/soundEffects';
import { useAuth } from '../context/AuthContext';

export default function Notifications({ onBack, onSelectIdea }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'ideas' | 'system'
  const [soundSettings, setSoundState] = useState(getSoundSettings());
  const [actionNotice, setActionNotice] = useState('');

  useEffect(() => {
    // Initial fetch from supabase if authenticated, otherwise local cache
    if (currentUser?.id) {
      notificationService.fetchNotifications(currentUser.id).then(list => {
        if (Array.isArray(list)) setNotifications(list);
      });
    } else {
      setNotifications(notificationService.getNotifications());
    }

    const unsubscribe = notificationService.subscribe((data) => {
      if (Array.isArray(data)) {
        setNotifications(data);
      } else if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      } else {
        setNotifications(notificationService.getNotifications());
      }
    });
    return unsubscribe;
  }, [currentUser?.id]);

  const handleToggleSound = () => {
    const updated = { ...soundSettings, enabled: !soundSettings.enabled };
    setSoundSettings(updated);
    setSoundState(updated);
    if (updated.enabled) {
      playNotificationSound(updated.soundType, true);
    }
  };

  const handleSoundToneChange = (tone) => {
    const updated = { ...soundSettings, soundType: tone };
    setSoundSettings(updated);
    setSoundState(updated);
    playNotificationSound(tone, true);
  };

  const handleTestSound = () => {
    playNotificationSound(soundSettings.soundType, true);
  };

  const handleSendTestNotification = () => {
    const sampleTypes = [
      {
        type: 'voice',
        title: 'New Voice Discussion 🎙️',
        message: 'Kiran added a 45s audio note to "Voice Productivity Assistant".'
      },
      {
        type: 'idea',
        title: 'Idea Updated 💡',
        message: 'Rahul uploaded an architecture flowchart to "AI Resume Builder".'
      },
      {
        type: 'member',
        title: 'New Collaborator Joined 👥',
        message: 'Priya accepted your invitation to collaborate on Ideate.'
      },
      {
        type: 'discussion',
        title: 'New Comment 💬',
        message: 'Arun commented: "The timeline interface looks ultra clean!"'
      }
    ];

    const pick = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
    notificationService.addNotification({
      title: pick.title,
      message: pick.message,
      type: pick.type,
      playSound: true
    });

    setActionNotice('Notification added & sound played!');
    setTimeout(() => setActionNotice(''), 3000);
  };

  const handleMarkAsRead = (id) => {
    notificationService.markAsRead(id);
  };

  const handleToggleRead = (id) => {
    notificationService.toggleReadStatus(id);
  };

  const handleDelete = (id) => {
    notificationService.deleteNotification(id);
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead(currentUser?.id);
    setActionNotice('All notifications marked as read');
    setTimeout(() => setActionNotice(''), 3000);
  };

  const handleConfirmClear = () => {
    notificationService.clearAll(currentUser?.id);
    setActionNotice('All notifications cleared');
    setShowClearConfirm(false);
    setTimeout(() => setActionNotice(''), 3000);
  };

  // Safe notifications list
  const safeList = Array.isArray(notifications) ? notifications : [];

  // Filtered notifications
  const filteredNotifications = safeList.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'ideas') return ['idea', 'voice', 'discussion'].includes(n.type);
    if (filter === 'system') return ['system', 'member'].includes(n.type);
    return true;
  });

  const unreadCount = safeList.filter(n => !n.is_read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'voice':
        return <Mic className="w-4 h-4 text-purple-600" />;
      case 'idea':
        return <FolderKanban className="w-4 h-4 text-blue-600" />;
      case 'member':
        return <Users className="w-4 h-4 text-emerald-600" />;
      case 'discussion':
        return <MessageSquare className="w-4 h-4 text-amber-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'voice':
        return 'bg-purple-100';
      case 'idea':
        return 'bg-blue-100';
      case 'member':
        return 'bg-emerald-100';
      case 'discussion':
        return 'bg-amber-100';
      default:
        return 'bg-indigo-100';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return 'Just now';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-xs"
              title="Back to Workspace"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 leading-none">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-600 text-white">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendTestNotification}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/70 transition shadow-xs"
              title="Add a sample notification and trigger sound"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send Test Notification</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}

            {safeList.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Toast / Notice alert */}
        {actionNotice && (
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs sm:text-sm font-semibold text-blue-800 flex items-center justify-between shadow-xs animate-fade-in">
            <span>{actionNotice}</span>
            <Check className="w-4 h-4 text-blue-600" />
          </div>
        )}

        {/* Audio / Sound Settings Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSound}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  soundSettings.enabled
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-400'
                }`}
                title={soundSettings.enabled ? 'Click to Mute Notification Sounds' : 'Click to Enable Notification Sounds'}
              >
                {soundSettings.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Notification Sounds
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    soundSettings.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {soundSettings.enabled ? 'Enabled' : 'Muted'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Play real-time synthesized acoustic tones when new ideas, comments, or activities occur.
                </p>
              </div>
            </div>

            {/* Sound Tone selector pills & Test button */}
            <div className="flex items-center gap-2 flex-wrap">
              {['chime', 'ding', 'pop', 'bell'].map((tone) => (
                <button
                  key={tone}
                  onClick={() => handleSoundToneChange(tone)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                    soundSettings.soundType === tone
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {tone}
                </button>
              ))}

              <button
                onClick={handleTestSound}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title="Play current sound"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All', count: safeList.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'ideas', label: 'Ideas & Discussions', count: safeList.filter(n => ['idea', 'voice', 'discussion'].includes(n.type)).length },
            { id: 'system', label: 'System & Team', count: safeList.filter(n => ['system', 'member'].includes(n.type)).length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`relative flex items-start gap-3.5 sm:gap-4 p-4 rounded-2xl border transition-all ${
                  notif.is_read
                    ? 'bg-white/70 border-slate-200/70 hover:bg-white'
                    : 'bg-white border-blue-200/90 shadow-xs ring-1 ring-blue-500/10'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${getIconBg(notif.type)} shadow-xs`}>
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-8 sm:pr-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-semibold truncate ${notif.is_read ? 'text-slate-800' : 'text-slate-900 font-bold'}`}>
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="Unread"></span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-400">
                    <span>{formatTime(notif.created_at)}</span>

                    {notif.ideaId && onSelectIdea && (
                      <button
                        onClick={() => onSelectIdea({ id: notif.ideaId, title: notif.title })}
                        className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition"
                      >
                        <span>View Idea</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleRead(notif.id)}
                      className="text-slate-500 hover:text-slate-800 font-medium transition"
                    >
                      {notif.is_read ? 'Mark as unread' : 'Mark as read'}
                    </button>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(notif.id)}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition flex-shrink-0"
                  title="Remove notification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto my-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3.5">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">All caught up!</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {filter === 'unread'
                ? 'You have zero unread notifications right now.'
                : 'No notifications in this category. You will hear a pleasant chime when activities arrive.'}
            </p>
            <button
              onClick={handleSendTestNotification}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 mx-auto"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Send Sample Notification</span>
            </button>
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Clear Notifications?</h3>
                <p className="text-xs text-slate-500">Remove all current notifications</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to clear all notifications from your notification feed?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
