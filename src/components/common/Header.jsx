import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Menu, ChevronDown, Layers, Shield, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRandomAvatar } from '../../data/avatars';
import { notificationService } from '../../services/notificationService';

export default function Header({ 
  onOpenMobileMenu, 
  searchQuery, 
  onSearchChange, 
  onSelectAllIdeas, 
  onOpenProfile,
  onOpenNotifications,
  onOpenAdmin
}) {
  const { currentUser, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(notificationService.getUnreadCount());
  const profileMenuRef = useRef(null);

  useEffect(() => {
    setUnreadCount(notificationService.getUnreadCount());
    const unsub = notificationService.subscribe(() => {
      setUnreadCount(notificationService.getUnreadCount());
    });
    return unsub;
  }, []);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Mobile Brand / Menu Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div 
          onClick={onSelectAllIdeas}
          className="lg:hidden flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="Ideate Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-extrabold text-base text-slate-900 tracking-tight">Ideate</span>
        </div>
      </div>

      {/* Search Bar matching Screenshot */}
      <div className="flex-1 max-w-md mx-2 sm:mx-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search ideas..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Right User & Notification Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Admin Console Shortcut */}
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition shadow-2xs"
            title="Open Admin Console"
          >
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* Notification Bell */}
        <button 
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-300"></span>
          )}
        </button>

        {/* User Pill Dropdown - Positioned directly under the account holder's name */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(prev => !prev)}
            className={`flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-2xl transition border ${
              showProfileMenu 
                ? 'bg-slate-100 border-slate-300 shadow-xs' 
                : 'hover:bg-slate-100 border-transparent'
            }`}
            title="Account Menu"
          >
            <img
              src={currentUser?.avatar_url || getRandomAvatar(currentUser?.email || currentUser?.display_name || 'User')}
              alt={currentUser?.display_name || 'Account'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-2xs flex-shrink-0 bg-slate-100"
            />
            <span className="inline-block text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
              {currentUser?.display_name || 'User'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180 text-blue-600' : ''}`} />
          </button>

          {showProfileMenu && (
            <div 
              className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-scale-in"
            >
              {/* Pointer triangle centered under account name */}
              <div className="hidden sm:block absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-200/80 rotate-45"></div>

              {/* User details header */}
              <div className="px-3 py-2 text-xs relative z-10">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900 truncate">{currentUser?.display_name || 'Member'}</p>
                  {isAdmin && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700">Admin</span>
                  )}
                </div>
                <p className="text-slate-400 truncate text-[11px] mt-0.5">{currentUser?.email}</p>
              </div>

              <div className="border-t border-slate-100 my-1"></div>

              {/* Options: Profile, Logout (+ Admin if admin) */}
              <div className="space-y-0.5 relative z-10">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenAdmin) onOpenAdmin();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-purple-700 font-bold hover:bg-purple-50 rounded-xl flex items-center gap-2 transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    <span>Admin Console</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenProfile) onOpenProfile();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 font-bold hover:bg-slate-50 hover:text-blue-600 rounded-xl flex items-center gap-2 transition"
                >
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-rose-600 font-bold hover:bg-rose-50 rounded-xl flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
