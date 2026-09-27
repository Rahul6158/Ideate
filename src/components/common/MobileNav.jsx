import React, { useState, useEffect } from 'react';
import { Home, Search, Bell, User, Plus } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

import { useAuth } from '../../context/AuthContext';

export default function MobileNav({ activeTab, onTabChange, onOpenNewIdea }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const [unreadCount, setUnreadCount] = useState(notificationService.getUnreadCount());

  useEffect(() => {
    setUnreadCount(notificationService.getUnreadCount());
    const unsub = notificationService.subscribe(() => {
      setUnreadCount(notificationService.getUnreadCount());
    });
    return unsub;
  }, []);

  return (
    <>
      {/* Floating Action Button (FAB) matching screenshot - for members only */}
      {!isAdmin && (
        <button
          onClick={onOpenNewIdea}
          className="lg:hidden fixed right-5 bottom-20 z-40 w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-floating flex items-center justify-center transition-transform"
          title="New Idea"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Mobile Bottom Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-6 py-2 flex items-center justify-between">
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'search' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>

        <button
          onClick={() => onTabChange('notifications')}
          className={`relative flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'notifications' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
            )}
          </div>
          <span>Notifications</span>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
            activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
}
