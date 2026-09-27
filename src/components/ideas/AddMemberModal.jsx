import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, UserCheck, Shield } from 'lucide-react';
import { memberService } from '../../services/memberService';
import { useAuth } from '../../context/AuthContext';
import { getRandomAvatar } from '../../data/avatars';

export default function AddMemberModal({ isOpen, onClose, ideaId, onMemberAdded }) {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState('Member');
  const [isSearching, setIsSearching] = useState(false);
  const [existingMemberIds, setExistingMemberIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch current idea members on modal open to prevent adding existing members
  useEffect(() => {
    if (isOpen && ideaId) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setError('');
      setSuccess(false);

      memberService.getMembers(ideaId).then(members => {
        const idSet = new Set((members || []).map(m => m.user_id).filter(Boolean));
        setExistingMemberIds(idSet);
      }).catch(err => {
        console.warn('Could not load current members:', err);
      });
    }
  }, [isOpen, ideaId]);

  // Live database search as the user types email
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError('');
      try {
        const results = await memberService.searchUsers(searchQuery);
        setSearchResults(results || []);
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedUser) {
      setError('Please search and select a registered member first.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const newMember = await memberService.addMember(ideaId, selectedUser, role);
      setSuccess(true);
      setTimeout(() => {
        onMemberAdded(newMember);
        onClose();
        setSearchQuery('');
        setSelectedUser(null);
        setSuccess(false);
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Add Collaborator</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
              Find registered users by email to invite them into this idea space.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <UserCheck className="w-4 h-4 flex-shrink-0" />
            <span>Collaborator added successfully!</span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Live Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Search Registered Users
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedUser && selectedUser.email !== e.target.value) {
                    setSelectedUser(null);
                  }
                }}
                placeholder="Type member email (e.g. rahul@gmail.com)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
              {isSearching ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                </div>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedUser(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Search Results Dropdown/List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                Database Matches ({searchResults.length})
              </div>
            )}

            {searchResults.map((user) => {
              const isSelf = currentUser?.id === user.id || currentUser?.email === user.email;
              const isAlreadyMember = existingMemberIds.has(user.id);
              const isSelected = selectedUser?.id === user.id;

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    if (isSelf || isAlreadyMember) return;
                    setSelectedUser(user);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-100 shadow-2xs'
                      : isSelf || isAlreadyMember
                      ? 'bg-slate-50/70 border-slate-100 opacity-60 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 cursor-pointer shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.avatar_url || getRandomAvatar(user.email || user.display_name)}
                      alt={user.display_name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {user.display_name || user.email.split('@')[0]}
                        </span>
                        {user.role === 'admin' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    </div>
                  </div>

                  {/* Status / Select badge */}
                  <div>
                    {isSelf ? (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-lg">
                        You (Owner)
                      </span>
                    ) : isAlreadyMember ? (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                        Already Member
                      </span>
                    ) : isSelected ? (
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        Selected
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* No matches state */}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-center">
                <AlertCircle className="w-5 h-5 mx-auto text-amber-600 mb-1.5" />
                <p className="text-xs font-bold">No registered account found</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  "{searchQuery}" has not signed up for Ideate yet. Members can only be added if they have an active account in the app.
                </p>
              </div>
            )}
          </div>

          {/* Selected User Confirmation & Role */}
          {selectedUser && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={selectedUser.avatar_url || getRandomAvatar(selectedUser.email)}
                  alt={selectedUser.display_name}
                  className="w-8 h-8 rounded-full object-cover border border-white shadow-2xs"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    Ready to add: {selectedUser.display_name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{selectedUser.email}</div>
                </div>
              </div>

              {/* Role Select */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <label className="text-[11px] font-semibold text-slate-500">Role:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Member">Member</option>
                  <option value="Editor">Editor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedUser || loading}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                !selectedUser || loading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Add Collaborator</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
