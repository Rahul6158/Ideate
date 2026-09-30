import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  FileText,
  Users,
  Bell,
  Plus,
  ChevronRight,
  LogOut,
  X,
  Layers,
  Sparkles,
  User,
  Shield,
  KeyRound,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRandomAvatar } from '../../data/avatars';
import { notificationService } from '../../services/notificationService';
import { getIdeaTheme } from '../../data/themePalettes';

export default function Sidebar({
  ideas = [],
  activeIdeaId,
  onSelectIdea,
  onSelectAllIdeas,
  onOpenNewIdea,
  onOpenJoinIdea,
  onOpenAuth,
  onOpenProfile,
  onOpenNotifications,
  onOpenAdmin,
  isAdminOpen = false,
  isOpen = false,
  onClose,
  onEditIdea,
  onDeleteIdea
}) {
  const { currentUser, logout, isSupabaseConfigured } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openIdeaMenuId, setOpenIdeaMenuId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(notificationService.getUnreadCount());
  const [unreadCounts, setUnreadCounts] = useState(notificationService.getUnreadCounts());

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';

  // Close idea menu when clicking outside
  useEffect(() => {
    if (!openIdeaMenuId) return;
    const handleDocClick = () => setOpenIdeaMenuId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [openIdeaMenuId]);

  useEffect(() => {
    setUnreadCount(notificationService.getUnreadCount());
    setUnreadCounts(notificationService.getUnreadCounts());

    if (currentUser?.id) {
      notificationService.fetchUnreadCounts(currentUser.id);
    }

    const unsub = notificationService.subscribe((data) => {
      setUnreadCount(data?.unreadCount ?? notificationService.getUnreadCount());
      setUnreadCounts(data?.unreadCounts ?? notificationService.getUnreadCounts());
    });
    return unsub;
  }, [currentUser?.id]);

  const uniqueIdeas = Array.from(new Map((ideas || []).map(i => [i.id, i])).values());
  const myIdeas = uniqueIdeas.filter(i => i.owner_id === currentUser?.id);
  const sharedIdeas = uniqueIdeas.filter(
    i =>
      i.owner_id !== currentUser?.id &&
      !i.is_pending_invite &&
      (i.is_shared ||
        i.idea_members?.some(
          m => m.user_id === currentUser?.id && m.role !== 'pending_invite' && m.role !== 'pending_join'
        ))
  );

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Top Brand & Navigation */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center justify-between mb-6">
          <div
            onClick={onSelectAllIdeas}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="Ideate Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Idea<span className="text-blue-600">te</span>
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* All Ideas Nav */}
        <button
          onClick={() => {
            onSelectAllIdeas();
            if (onClose) onClose();
          }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all mb-2 ${!activeIdeaId && !isAdminOpen
              ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
        >
          <FolderKanban className="w-4 h-4 text-blue-600" />
          <span>All Ideas</span>
        </button>

        {/* Admin Portal Button */}
        {isAdmin && (
          <button
            onClick={() => {
              if (onOpenAdmin) onOpenAdmin();
              if (onClose) onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all mb-6 ${isAdminOpen
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 border border-amber-200/60'
              }`}
          >
            <Shield className={`w-4 h-4 ${isAdminOpen ? 'text-white' : 'text-amber-600'}`} />
            <span>Admin Console</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider bg-white/30 text-current px-1.5 py-0.5 rounded-full font-extrabold">
              PRO
            </span>
          </button>
        )}
        {!isAdmin && <div className="mb-4" />}

        {/* MY IDEAS Section */}
        <div className="mb-6">
          <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            My Ideas
          </div>
          <div className="space-y-1">
            {myIdeas.map(idea => {
              const theme = getIdeaTheme(idea.color_theme);
              const unread = unreadCounts[idea.id] || 0;
              const isActive = activeIdeaId === idea.id;

              const canManage = idea.owner_id === currentUser?.id || idea.user_id === currentUser?.id || idea.created_by === currentUser?.id || isAdmin;

              return (
                <div key={idea.id} className="relative group w-full flex items-center">
                  <button
                    onClick={() => {
                      onSelectIdea(idea);
                      if (onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 pr-9 rounded-xl text-xs sm:text-sm font-medium transition text-left truncate relative ${isActive
                        ? 'text-white font-bold shadow-sm'
                        : 'text-slate-800 hover:text-slate-950'
                      }`}
                    style={{
                      backgroundColor: isActive ? theme.hex : `${theme.hex}15`,
                      borderLeft: `3.5px solid ${theme.hex}`
                    }}
                  >
                    {/* Cover image or colored initial */}
                    {idea.cover_url ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={idea.cover_url}
                          alt={idea.title}
                          className="w-6 h-6 rounded-lg object-cover ring-1 ring-black/10 shadow-2xs"
                        />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: theme.hex }}
                          title={theme.name || 'Theme palette'}
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[10px] flex-shrink-0 shadow-2xs ${isActive ? 'bg-white/20 text-white' : 'text-white'
                          }`}
                        style={{ backgroundColor: isActive ? undefined : theme.hex }}
                      >
                        {idea.title ? idea.title.charAt(0).toUpperCase() : '💡'}
                      </div>
                    )}

                    <span className="truncate flex-1 font-semibold">{idea.title}</span>

                    {/* Unread message counter badge */}
                    {unread > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 shadow-2xs ${isActive ? 'bg-white text-slate-900' : 'bg-red-500 text-white animate-pulse'
                          }`}
                        title={`${unread} unread messages`}
                      >
                        {unread}
                      </span>
                    )}
                  </button>

                  {/* Options Menu Button (Three-dots) - Clean and clearly visible */}
                  {canManage && (onEditIdea || onDeleteIdea) && (
                    <div className="absolute right-1.5 flex items-center z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenIdeaMenuId(prev => prev === idea.id ? null : idea.id);
                        }}
                        className={`p-1 rounded-lg transition ${
                          openIdeaMenuId === idea.id 
                            ? 'opacity-100 bg-black/15' 
                            : 'opacity-60 hover:opacity-100 group-hover:opacity-100'
                        } ${
                          isActive 
                            ? 'text-white hover:bg-white/25' 
                            : 'text-slate-500 hover:text-slate-900 hover:bg-black/10'
                        }`}
                        title="Idea options (Edit / Delete)"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {openIdeaMenuId === idea.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-50 animate-scale-in text-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onEditIdea && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenIdeaMenuId(null);
                                onEditIdea(idea);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 font-medium text-slate-700 text-left transition"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit Idea</span>
                            </button>
                          )}
                          {onDeleteIdea && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenIdeaMenuId(null);
                                onDeleteIdea(idea);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 font-medium text-red-600 text-left transition"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>Delete Idea</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SHARED WITH ME Section */}
        <div className="mb-6">
          <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Shared With Me
          </div>
          <div className="space-y-1">
            {sharedIdeas.length === 0 ? (
              <div className="px-3 text-xs text-slate-400 italic">No shared ideas yet</div>
            ) : (
              sharedIdeas.map(idea => {
                const theme = getIdeaTheme(idea.color_theme);
                const unread = unreadCounts[idea.id] || 0;
                const isActive = activeIdeaId === idea.id;
                const canManage = idea.owner_id === currentUser?.id || idea.user_id === currentUser?.id || isAdmin;

                return (
                  <div key={idea.id} className="relative group w-full flex items-center">
                    <button
                      onClick={() => {
                        onSelectIdea(idea);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 pr-9 rounded-xl text-xs sm:text-sm font-medium transition text-left truncate relative ${isActive
                          ? 'text-white font-bold shadow-sm'
                          : 'text-slate-800 hover:text-slate-950'
                        }`}
                      style={{
                        backgroundColor: isActive ? theme.hex : `${theme.hex}15`,
                        borderLeft: `3.5px solid ${theme.hex}`
                      }}
                    >
                      {/* Cover image or colored initial */}
                      {idea.cover_url ? (
                        <div className="relative flex-shrink-0">
                          <img
                            src={idea.cover_url}
                            alt={idea.title}
                            className="w-6 h-6 rounded-lg object-cover ring-1 ring-black/10 shadow-2xs"
                          />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white"
                            style={{ backgroundColor: theme.hex }}
                            title={theme.name || 'Theme palette'}
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[10px] flex-shrink-0 shadow-2xs ${isActive ? 'bg-white/20 text-white' : 'text-white'
                            }`}
                          style={{ backgroundColor: isActive ? undefined : theme.hex }}
                        >
                          {idea.title ? idea.title.charAt(0).toUpperCase() : '👥'}
                        </div>
                      )}

                      <span className="truncate flex-1 font-semibold">{idea.title}</span>

                      {/* Unread message counter badge */}
                      {unread > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 shadow-2xs ${isActive ? 'bg-white text-slate-900' : 'bg-red-500 text-white animate-pulse'
                            }`}
                          title={`${unread} unread messages`}
                        >
                          {unread}
                        </span>
                      )}
                    </button>

                    {/* Options Menu Button (Three-dots) for shared ideas */}
                    {canManage && (onEditIdea || onDeleteIdea) && (
                      <div className="absolute right-1.5 flex items-center z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenIdeaMenuId(prev => prev === idea.id ? null : idea.id);
                          }}
                          className={`p-1 rounded-lg transition ${
                            openIdeaMenuId === idea.id 
                              ? 'opacity-100 bg-black/15' 
                              : 'opacity-60 hover:opacity-100 group-hover:opacity-100'
                          } ${
                            isActive 
                              ? 'text-white hover:bg-white/25' 
                              : 'text-slate-500 hover:text-slate-900 hover:bg-black/10'
                          }`}
                          title="Idea options (Edit / Delete)"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown Menu */}
                        {openIdeaMenuId === idea.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-50 animate-scale-in text-slate-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {onEditIdea && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenIdeaMenuId(null);
                                  onEditIdea(idea);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 font-medium text-slate-700 text-left transition"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit Idea</span>
                              </button>
                            )}
                            {onDeleteIdea && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenIdeaMenuId(null);
                                  onDeleteIdea(idea);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 font-medium text-red-600 text-left transition"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Delete Idea</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* New Idea & Join with ID Buttons (Members only, not Admin) */}
        {!isAdmin && (
          <div className="space-y-2">
            <button
              onClick={() => {
                onOpenNewIdea();
                if (onClose) onClose();
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Idea</span>
            </button>

            {onOpenJoinIdea && (
              <button
                onClick={() => {
                  onOpenJoinIdea();
                  if (onClose) onClose();
                }}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Join with ID</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Profile & Notifications */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          onClick={onOpenNotifications}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition mb-2"
          title="Notifications"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-slate-400" />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Current User Row */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser?.avatar_url || getRandomAvatar(currentUser?.email || currentUser?.display_name || 'User')}
                alt={currentUser?.display_name || 'User'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
              />
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {currentUser?.display_name || 'Member'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {currentUser?.email || ''}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>

          {/* User Menu / Account Switcher */}
          {showUserMenu && (
            <div
              className="absolute left-0 bottom-full mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200/80 p-2 z-30 animate-fade-in"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="px-3 py-2 text-xs">
                <p className="font-bold text-slate-900">{currentUser?.display_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
              </div>

              <div className="my-1 border-t border-slate-100"></div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  if (onOpenProfile) onOpenProfile();
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>My Profile</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onOpenAdmin) onOpenAdmin();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50 transition"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin Console</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200/80 h-screen sticky top-0 flex-shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 animate-slide-right flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
