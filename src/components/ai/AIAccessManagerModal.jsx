import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  UserCheck, 
  UserX, 
  Power, 
  AlertCircle,
  HelpCircle,
  Check,
  EyeOff,
  AtSign,
  Lock,
  Unlock
} from 'lucide-react';
import { aiService, IDVY_BOT_USER } from '../../services/aiService';
import { getRandomAvatar } from '../../data/avatars';

export default function AIAccessManagerModal({ 
  isOpen, 
  onClose, 
  idea, 
  members = [], 
  currentUser 
}) {
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [accessMap, setAccessMap] = useState({}); // { [userId]: { can_use_otr: boolean, can_tag_ai: boolean } }
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const isOwner = idea?.owner_id === currentUser?.id || idea?.user_id === currentUser?.id || idea?.created_by === currentUser?.id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'tushrahul58@gmail.com';
  const canManage = isOwner || isAdmin;

  const pauseState = aiService.getIdeaPauseState(idea?.id);
  const isPausedByAdmin = pauseState.paused_by_admin;

  useEffect(() => {
    if (isOpen && idea?.id) {
      loadAccess();
    }
  }, [isOpen, idea?.id, members]);

  // Listen to realtime permission updates if changed from another device or command
  useEffect(() => {
    if (!isOpen || !idea?.id) return;
    const handlePermUpdate = (e) => {
      if (e.detail?.ideaId === idea.id && e.detail?.full_map) {
        setAccessMap(prev => ({ ...prev, ...e.detail.full_map }));
      }
    };
    window.addEventListener('ideate:ai_permissions_updated', handlePermUpdate);
    return () => window.removeEventListener('ideate:ai_permissions_updated', handlePermUpdate);
  }, [isOpen, idea?.id]);

  const loadAccess = async () => {
    try {
      const initialMap = {};
      members.forEach(m => {
        const uid = m.user_id || m.id;
        if (uid) {
          const roleStr = String(m.role || '').toLowerCase();
          const hasOtrRole = roleStr.includes('otr') || (roleStr.includes('member:ai') && !roleStr.includes('tag'));
          const hasTagRole = roleStr.includes('tag') || (roleStr.includes('member:ai') && !roleStr.includes('otr'));

          initialMap[uid] = {
            can_use_otr: typeof m.can_use_otr === 'boolean' ? m.can_use_otr : hasOtrRole,
            can_tag_ai: typeof m.can_tag_ai === 'boolean' ? m.can_tag_ai : hasTagRole
          };
        }
      });

      try {
        const saved = localStorage.getItem(`idvy_access_${idea?.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.members) {
            Object.keys(parsed.members).forEach(uid => {
              const item = parsed.members[uid];
              if (typeof item === 'boolean') {
                initialMap[uid] = { can_use_otr: item, can_tag_ai: item };
              } else if (item && typeof item === 'object') {
                initialMap[uid] = {
                  can_use_otr: item.can_use_otr === true,
                  can_tag_ai: item.can_tag_ai === true
                };
              }
            });
          }
          if (typeof parsed.is_ai_enabled === 'boolean') {
            setIsAiEnabled(parsed.is_ai_enabled);
          }
        }
      } catch (_) {}
      setAccessMap(initialMap);
    } catch (err) {
      console.warn('Failed to load AI access settings:', err);
    }
  };

  if (!isOpen) return null;

  const handleToggleGlobalAI = async () => {
    if (!canManage) return;
    if (isPausedByAdmin && !isAdmin) {
      alert('Idvy was paused by a platform administrator. Only an admin can resume it.');
      return;
    }

    setIsUpdating(true);
    try {
      const nextState = !isAiEnabled;
      await aiService.toggleAIForIdea(idea.id, nextState, isAdmin);
      setIsAiEnabled(nextState);
      setStatusMessage(`Idvy ${nextState ? 'active' : 'paused'} for this idea.`);
      setTimeout(() => setStatusMessage(''), 2500);
    } catch (err) {
      console.warn('Toggle global AI notice:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle a single granular permission independently
  const handleTogglePermission = async (userId, permKey) => {
    if (!canManage) return;
    const currentPerms = accessMap[userId] || { can_use_otr: false, can_tag_ai: false };
    const nextVal = !currentPerms[permKey];

    const updatedUserPerms = {
      ...currentPerms,
      [permKey]: nextVal
    };

    const nextMap = {
      ...accessMap,
      [userId]: updatedUserPerms
    };

    setIsUpdating(true);
    try {
      await aiService.setMemberGranularAccess(idea.id, userId, updatedUserPerms, nextMap, currentUser);
      setAccessMap(nextMap);

      const permLabel = permKey === 'can_use_otr' ? 'Off-Chat (OTR)' : 'Tagging (@Idvy)';
      setStatusMessage(`${permLabel}: ${nextVal ? 'Granted' : 'Revoked'}.`);
      setTimeout(() => setStatusMessage(''), 2500);
    } catch (err) {
      console.warn('Toggle granular AI permission error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Grant or Revoke both permissions for a user
  const handleToggleAllPermissions = async (userId, grantAll) => {
    if (!canManage) return;
    const updatedUserPerms = {
      can_use_otr: grantAll,
      can_tag_ai: grantAll
    };

    const nextMap = {
      ...accessMap,
      [userId]: updatedUserPerms
    };

    setIsUpdating(true);
    try {
      await aiService.setMemberGranularAccess(idea.id, userId, updatedUserPerms, nextMap, currentUser);
      setAccessMap(nextMap);

      setStatusMessage(`All permissions ${grantAll ? 'granted' : 'revoked'}.`);
      setTimeout(() => setStatusMessage(''), 2500);
    } catch (err) {
      console.warn('Toggle all AI permissions error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter out Idvy bot itself from the member permissions list
  const humanMembers = members.filter(m => !m.is_ai && m.id !== IDVY_BOT_USER.id && m.email !== 'idvy@ideate.app');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-purple-100 animate-scale-in max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Idvy AI Permissions</h3>
              <p className="text-xs text-slate-500">Granular owner control over Off-Chat and Tagging</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className="mt-3 p-2 rounded-xl bg-purple-50 text-purple-800 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
            <Check className="w-3.5 h-3.5 text-purple-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Global AI Switch */}
        <div className="my-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50/50 border border-purple-200/80 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
              <span>Idvy Collaborator Status</span>
              {isAiEnabled ? (
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">Active</span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">Paused</span>
              )}
            </div>
            <p className="text-[11px] text-purple-900/70 mt-0.5">
              {isAiEnabled 
                ? 'Idvy will respond to authorized members via Off-Chat and @mentions.'
                : 'Idvy is paused and will ignore all interactions across this idea.'}
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={handleToggleGlobalAI}
              disabled={isUpdating}
              className={`p-2 rounded-xl border transition shadow-2xs flex-shrink-0 ${
                isAiEnabled
                  ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
              }`}
              title={isAiEnabled ? 'Pause Idvy' : 'Enable Idvy'}
            >
              <Power className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collaborators Access List */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pr-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Collaborator Permissions ({humanMembers.length})</span>
            <span className="text-[10px] font-normal text-slate-400">Independent permissions</span>
          </div>

          {humanMembers.map((member) => {
            const uid = member.user_id || member.id;
            const isUserOwner = member.role === 'Owner' || uid === idea.owner_id || uid === idea.user_id;
            const perms = accessMap[uid] || { can_use_otr: false, can_tag_ai: false };
            const hasOTR = isUserOwner || perms.can_use_otr === true;
            const hasTag = isUserOwner || perms.can_tag_ai === true;

            return (
              <div 
                key={uid}
                className="p-3 rounded-2xl bg-white hover:bg-purple-50/20 border border-slate-200/80 transition shadow-2xs space-y-2"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatar_url || getRandomAvatar(member.email || member.display_name)}
                      alt={member.display_name}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {member.display_name || member.email}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {isUserOwner ? 'Idea Owner' : (member.role || 'Member')}
                      </div>
                    </div>
                  </div>

                  {isUserOwner ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0">
                      Full Control (Owner)
                    </span>
                  ) : canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAllPermissions(uid, !(hasOTR && hasTag))}
                        disabled={isUpdating}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 px-2 py-0.5 rounded-md hover:bg-purple-50 border border-purple-200/60 transition"
                      >
                        {hasOTR && hasTag ? 'Revoke All' : 'Grant Both'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Granular Permission Toggles (Independent: Off-Chat & Tagging) */}
                {!isUserOwner && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    {/* 1. Off-Chat Access Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePermission(uid, 'can_use_otr')}
                      disabled={isUpdating || !canManage}
                      className={`flex items-center justify-between p-2 rounded-xl border text-left transition ${
                        hasOTR
                          ? 'bg-purple-50 hover:bg-purple-100/70 border-purple-200 text-purple-950 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                      title={hasOTR ? "Revoke Off-Chat (OTR) access" : "Grant Off-Chat (OTR) access"}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <EyeOff className={`w-3.5 h-3.5 flex-shrink-0 ${hasOTR ? 'text-purple-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">Off-Chat (OTR)</div>
                          <div className="text-[9px] text-slate-400">Private AI chat</div>
                        </div>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-1 transition-colors ${
                        hasOTR ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'
                      }`} />
                    </button>

                    {/* 2. Tagging Access Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePermission(uid, 'can_tag_ai')}
                      disabled={isUpdating || !canManage}
                      className={`flex items-center justify-between p-2 rounded-xl border text-left transition ${
                        hasTag
                          ? 'bg-blue-50 hover:bg-blue-100/70 border-blue-200 text-blue-950 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                      title={hasTag ? "Revoke Tagging access" : "Grant Tagging access"}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AtSign className={`w-3.5 h-3.5 flex-shrink-0 ${hasTag ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">Tagging (@Idvy)</div>
                          <div className="text-[9px] text-slate-400">Main chat mentions</div>
                        </div>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-1 transition-colors ${
                        hasTag ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer command reference */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>Chat commands: <code>/give.ai.accto @member [otr|tag]</code> · <code>/revoke.ai.accto @member [otr|tag]</code></span>
        </div>
      </div>
    </div>
  );
}
