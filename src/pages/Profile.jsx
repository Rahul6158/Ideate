import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Check, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  Save, 
  Calendar,
  Layers,
  MessageSquare,
  Mic,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_AVATARS, getRandomAvatar } from '../data/avatars';
import { authService } from '../services/authService';
import NotificationSettings from '../components/common/NotificationSettings';

export default function Profile({ onBack }) {
  const { currentUser, updateProfile, logout, isSupabaseConfigured } = useAuth();
  
  const initialAvatar = currentUser?.avatar_url || currentUser?.user_metadata?.avatar_url || getRandomAvatar(currentUser?.email || currentUser?.display_name);
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (currentUser?.display_name) setDisplayName(currentUser.display_name);
    const resolvedAvatar = currentUser?.avatar_url || currentUser?.user_metadata?.avatar_url || getRandomAvatar(currentUser?.email || currentUser?.display_name);
    if (resolvedAvatar) setSelectedAvatar(resolvedAvatar);
  }, [currentUser]);

  const categories = ['All', 'Creative', 'Pro', 'Avatar'];
  
  const filteredAvatars = selectedCategory === 'All' 
    ? AVAILABLE_AVATARS 
    : AVAILABLE_AVATARS.filter(a => a.category === selectedCategory);

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your display name.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);

    try {
      // Validate unique username if changed
      const currentClean = (currentUser?.display_name || '').trim().toLowerCase();
      if (cleanName.toLowerCase() !== currentClean) {
        const isAvail = await authService.isDisplayNameAvailable(cleanName, currentUser?.id);
        if (!isAvail) {
          setErrorMsg(`The username "${cleanName}" is already taken by another user. Please choose a different username.`);
          setSaving(false);
          return;
        }
      }

      await updateProfile({
        displayName: cleanName,
        avatarUrl: selectedAvatar
      });
      setSuccessMsg('Your profile has been successfully updated!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-xs"
              title="Back to Ideas"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Account Settings</h1>
              <p className="text-xs text-slate-500 mt-1">Manage your identity and avatar preferences</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Alerts */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 flex items-center gap-3 shadow-xs animate-fade-in">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-700 leading-relaxed shadow-xs">
            {errorMsg}
          </div>
        )}

        {/* Profile Card Header with Live Avatar Preview */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/60 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Main Avatar Display */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-blue-500/20 shadow-lg bg-slate-100 flex-shrink-0">
                <img
                  src={selectedAvatar}
                  alt={displayName || 'User Avatar'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {displayName || 'Ideate Member'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                  {isSupabaseConfigured ? 'Supabase Verified' : 'Active Creator'}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-500 flex items-center justify-center sm:justify-start gap-2 mb-4">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{currentUser?.email || 'user@ideate.app'}</span>
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Workspaces: Active</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>RLS Security: Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form & Avatar Selector */}
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Section 1: User Identity Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Personal Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">This name will appear on your discussions and idea cards</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Display Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              {/* Email Address (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Registered Email</span>
                </label>
                <div className="w-full px-4 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-sm font-semibold text-slate-600 flex items-center justify-between">
                  <span className="truncate">{currentUser?.email}</span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 ml-2 flex-shrink-0">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Choose Avatar Collection */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Choose Your Avatar</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick from our curated gallery of 26 creative avatar illustrations
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      selectedCategory === cat
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 sm:gap-4 pt-2">
              {filteredAvatars.map((avatar) => {
                const isSelected = selectedAvatar === avatar.src;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.src)}
                    className={`group relative rounded-2xl p-1.5 transition-all text-center ${
                      isSelected 
                        ? 'bg-blue-50 ring-2 ring-blue-600 shadow-md scale-105' 
                        : 'bg-slate-50 hover:bg-slate-100 hover:scale-102 border border-slate-200/80'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-white shadow-xs">
                      <img
                        src={avatar.src}
                        alt={avatar.name}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] font-bold text-slate-700 truncate px-1">
                      {avatar.name}
                    </div>

                    {/* Selected Check Badge */}
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-8 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Web Push Notification Settings */}
        <div className="mt-8">
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
