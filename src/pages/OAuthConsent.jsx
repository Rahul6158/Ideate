import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Globe, 
  Mail, 
  UserCheck, 
  ExternalLink, 
  ArrowLeft, 
  Sparkles,
  AlertCircle,
  HelpCircle,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OAuthConsent() {
  const { signInWithGoogle, isSupabaseConfigured } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (signInWithGoogle) {
        await signInWithGoogle();
      } else {
        throw new Error('Google Sign-In is not initialized.');
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setError(err.message || 'Failed to initiate Google authentication.');
      setLoading(false);
    }
  };

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 p-2 border border-white/20">
            <img src="/logo.png" alt="Ideate Logo" className="w-full h-full object-contain filter brightness-0 invert" onError={(e) => { e.target.style.display = 'none'; }} />
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Ideate <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">OAuth 2.0</span>
            </h1>
            <p className="text-xs text-slate-400">Google Authentication Consent & Permissions</p>
          </div>
        </div>

        <button
          onClick={handleReturnHome}
          className="px-3.5 py-1.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to App</span>
        </button>
      </header>

      {/* Main Consent Container */}
      <main className="max-w-4xl w-full mx-auto my-8 space-y-6">
        {/* Intro Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">OAuth Consent Screen</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Connecting Ideate with Google</h2>
              <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                Ideate utilizes Google OAuth 2.0 for single-click, passwordless authentication. This page outlines the specific scopes requested and how your personal data is handled.
              </p>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-2xl text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified App Scope</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Requested Permissions */}
          <div className="mt-8 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Requested Permissions & Scopes
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Scope 1: Userinfo Email */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4.5 hover:border-blue-500/30 transition">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Email Address</h4>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">.../auth/userinfo.email</div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Used as your primary account identifier and to route collaboration notifications and workspace updates.
                </p>
              </div>

              {/* Scope 2: Userinfo Profile */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4.5 hover:border-blue-500/30 transition">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Public Profile</h4>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">.../auth/userinfo.profile</div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Extracts your display name and Google avatar photo so your team members can recognize you in idea discussions.
                </p>
              </div>

              {/* Scope 3: OpenID */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4.5 hover:border-blue-500/30 transition">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">OpenID Identity</h4>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">openid</div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Cryptographically verifies your authentication state with Supabase without ever exposing your Google password.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Data Safeguards */}
          <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Data Privacy & Security Commitments
            </h3>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Password Storage:</strong> Ideate never handles, sees, or stores your Google password. Authentication is brokered via standardized OAuth 2.0 PKCE tokens.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Row-Level Security (RLS):</strong> Your ideas, discussions, and attachments are protected by PostgreSQL RLS in Supabase, preventing unauthorized member access.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>No Third-Party Sharing:</strong> We do not sell, rent, or monetize your personal information or workspace content with advertising networks.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Revocation at Any Time:</strong> You can disconnect Ideate from your Google Account at any time via{' '}
                  <a 
                    href="https://myaccount.google.com/permissions" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-400 underline hover:text-blue-300 font-semibold"
                  >
                    Google Account Security &rarr; Third-party apps
                  </a>.
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              By continuing, you agree to Ideate's workspace terms of service.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleReturnHome}
                className="w-1/2 sm:w-auto px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/10 text-xs font-semibold text-white transition active:scale-95 text-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-1/2 sm:w-auto px-6 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition shadow-lg shadow-white/10 active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.98 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                )}
                <span>Authorize with Google</span>
              </button>
            </div>
          </div>
        </div>

        {/* Developer & Verification Technical Details Card */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-xs text-slate-400 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-300">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>Application Metadata & Callback Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <span className="text-slate-500 block">App Home URL:</span>
              <a href="https://ideate-black.vercel.app" className="text-blue-400 hover:underline font-mono">
                https://ideate-black.vercel.app
              </a>
            </div>
            <div>
              <span className="text-slate-500 block">Consent Screen URL:</span>
              <a href="https://ideate-black.vercel.app/oauth/consent" className="text-blue-400 hover:underline font-mono">
                https://ideate-black.vercel.app/oauth/consent
              </a>
            </div>
            <div>
              <span className="text-slate-500 block">Authorized Redirect Callback:</span>
              <span className="text-slate-300 font-mono break-all">
                https://wxqpugsglytgnpmxmidg.supabase.co/auth/v1/callback
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Support / Privacy Inquiries:</span>
              <a href="mailto:admin@ideate.app" className="text-slate-300 font-mono hover:text-white">
                admin@ideate.app
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto py-4 text-center text-xs text-slate-500 border-t border-white/5">
        &copy; {new Date().getFullYear()} Ideate. All rights reserved. Powered by Supabase & Google Cloud Platform.
      </footer>
    </div>
  );
}
