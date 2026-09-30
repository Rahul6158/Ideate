import React, { useState } from 'react';
import { X, Plus, MoreVertical, Trash2, UserPlus, Copy, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { memberService } from '../../services/memberService';
import { getRandomAvatar } from '../../data/avatars';
import { IDVY_BOT_USER } from '../../services/aiService';

export default function MembersSheet({ isOpen, onClose, idea, members = [], onOpenAddMember, onMemberRemoved }) {
  const { currentUser } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!isOpen) return null;

  const isOwner = idea?.owner_id === currentUser?.id;

  const handleCopyIdeaId = () => {
    if (!idea?.id) return;
    navigator.clipboard.writeText(idea.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      await memberService.removeMember(idea.id, memberToRemove.id);
      onMemberRemoved(memberToRemove.id);
      setActiveMenuId(null);
      setMemberToRemove(null);
    } catch (err) {
      alert('Failed to remove member: ' + err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-slate-100 animate-slide-up flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-3 sm:hidden mx-auto"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">Members & Collaborators</h3>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200/60">
              {members.filter(m => !m.is_ai && m.user_id !== IDVY_BOT_USER.id && m.id !== IDVY_BOT_USER.id).length + 1}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Idea ID Box */}
        {idea?.id && (
          <div className="flex items-center justify-between p-2.5 mt-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="min-w-0 pr-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shareable Idea ID</div>
              <div className="text-xs font-mono text-slate-700 truncate select-all">{idea.id}</div>
            </div>
            <button
              type="button"
              onClick={handleCopyIdeaId}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-2xs flex-shrink-0"
              title="Copy ID to share with collaborators"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {/* Idvy AI Collaborator Permanent Participant */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 transition">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-purple-400 p-0.5 bg-gradient-to-tr from-purple-700 to-indigo-600 flex-shrink-0">
                <img
                  src="/avatars/idvy-avatar.avif"
                  alt="Idvy"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-purple-950 flex items-center gap-1.5 truncate">
                  <span>Idvy</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-purple-200/80 text-purple-800 text-[9px] font-bold uppercase tracking-wider">
                    AI Friend
                  </span>
                </div>
                <div className="text-xs text-purple-700 font-medium">
                  Collaborator & Idea Partner · Tag @Idvy
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0 border border-purple-200/60">
              Active
            </span>
          </div>

          {members.filter(m => !m.is_ai && m.user_id !== IDVY_BOT_USER.id && m.id !== IDVY_BOT_USER.id).map((member) => {
            const isPending = member.role === 'pending_invite';
            return (
              <div 
                key={member.id || member.user_id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={member.avatar_url || getRandomAvatar(member.email || member.display_name || 'Member')}
                    alt={member.display_name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {member.display_name || member.email}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isPending ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Invitation Sent
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 capitalize">
                          {member.role || 'Member'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Member options */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuId === member.id && (
                    <div 
                      className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200/80 p-1 z-20 animate-fade-in"
                      onMouseLeave={() => setActiveMenuId(null)}
                    >
                      {isOwner && member.role !== 'Owner' ? (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setMemberToRemove(member);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isPending ? 'Cancel Invite' : 'Remove'}</span>
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 text-xs text-slate-400">
                          {member.role === 'Owner' ? 'Idea Owner' : 'Member'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Remove Member Confirmation Overlay */}
        {memberToRemove && (
          <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 mb-3 animate-fade-in">
            <p className="text-xs font-semibold text-rose-900 mb-1">
              Remove {memberToRemove.display_name || memberToRemove.email}?
            </p>
            <p className="text-[11px] text-rose-700 mb-3">
              They will lose access to this idea workspace and discussions.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-3 py-1.5 rounded-lg border border-rose-200 text-slate-700 bg-white text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-2xs"
              >
                {isRemoving ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        )}

        {/* Invite Member Button */}
        {isOwner && (
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                onClose();
                onOpenAddMember();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-blue-600 text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Collaborator</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

