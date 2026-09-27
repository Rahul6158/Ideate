import React, { useState } from 'react';
import { X, Plus, MoreVertical, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { memberService } from '../../services/memberService';
import { getRandomAvatar } from '../../data/avatars';

export default function MembersSheet({ isOpen, onClose, idea, members = [], onOpenAddMember, onMemberRemoved }) {
  const { currentUser } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [memberToRemove, setMemberToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!isOpen) return null;

  const isOwner = idea?.owner_id === currentUser?.id;

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
            <h3 className="text-lg font-bold text-slate-900">Members</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {members.length}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {members.map((member) => (
            <div 
              key={member.id || member.user_id}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <img
                  src={member.avatar_url || getRandomAvatar(member.email || member.display_name || 'Member')}
                  alt={member.display_name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {member.display_name || member.email}
                  </div>
                  <div className="text-xs text-slate-400 capitalize">
                    {member.role || 'Member'}
                  </div>
                </div>
              </div>

              {/* Member options */}
              <div className="relative">
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
                        <span>Remove</span>
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
          ))}
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

        {/* Add Member Button */}
        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={() => {
              onClose();
              onOpenAddMember();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-blue-600 text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>
    </div>
  );
}
