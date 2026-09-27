import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  ArrowRight, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  KeyRound, 
  Sparkles,
  ShieldCheck,
  MailCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth({ initialMode = 'signup', onBack }) {
  const { login, signup, signInWithOAuth, resendConfirmationEmail, isSupabaseConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');

  // Form field states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Interaction states
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pending verification state (waiting for user to confirm email)
  const [pendingVerification, setPendingVerification] = useState(null);
  const [resendStatus, setResendStatus] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef(null);

  // Real-time Validation Checks
  const hasMinLength = password.length >= 6;
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isNameValid = displayName.trim().length >= 2;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  const handleModeSwitch = (targetSignUp) => {
    if (isSignUp === targetSignUp && !pendingVerification) return;
    setError('');
    setSuccess('');
    setPendingVerification(null);
    setIsSignUp(targetSignUp);
  };

  // Background auto-polling when waiting for confirmation
  useEffect(() => {
    if (!pendingVerification) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    setIsPolling(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        const user = await login(pendingVerification.email, pendingVerification.password);
        if (user) {
          // Successfully confirmed and logged in!
          clearInterval(pollTimerRef.current);
          setPendingVerification(null);
        }
      } catch (err) {
        // Still unconfirmed or waiting, continue polling silently
      }
    }, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pendingVerification]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Your email is not confirmed yet. Please check your inbox or click below to verify.');
        setPendingVerification({
          email: email.trim(),
          password: password,
          displayName: email.split('@')[0]
        });
      } else {
        setError(msg || 'Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isNameValid) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }
    if (!isEmailValid) {
      setError('Please enter a valid email address');
      return;
    }
    if (!hasMinLength) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await signup(email.trim(), password, displayName.trim());
      
      // If Supabase returned a session, the user is already authenticated directly
      if (res && res.session) {
        setSuccess('Account created successfully! Loading Ideate...');
        return;
      }

      // If email confirmation is required by Supabase:
      if (isSupabaseConfigured) {
        setPendingVerification({
          email: email.trim(),
          password: password,
          displayName: displayName.trim()
        });
      } else {
        setSuccess('Account created successfully! Loading Ideate...');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckConfirmation = async () => {
    if (!pendingVerification) return;
    setLoading(true);
    setError('');
    try {
      await login(pendingVerification.email, pendingVerification.password);
      setPendingVerification(null);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Confirmation pending: Please click the verification link sent to your email.');
      } else {
        setError(msg || 'Could not verify yet. Please try again in a few moments.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!pendingVerification?.email) return;
    setResendStatus('Sending...');
    try {
      await resendConfirmationEmail(pendingVerification.email);
      setResendStatus('Verification email resent! Check your inbox.');
      setTimeout(() => setResendStatus(''), 5000);
    } catch (err) {
      setResendStatus('Failed to resend. Please wait a minute and try again.');
    }
  };

  const handleSocialAuth = async (provider) => {
    setError('');
    setSocialLoading(provider);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err.message || `Unable to authenticate with ${provider}.`);
    } finally {
      setSocialLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-[#5ba6f5] flex items-center justify-center p-3 sm:p-5 font-sans select-none overflow-x-hidden">
      {/* Outer Card with reduced, compact footprint matching user request */}
      <div className="relative w-full max-w-[850px] min-h-[510px] bg-white rounded-[28px] sm:rounded-[34px] shadow-2xl shadow-blue-950/25 overflow-hidden border border-white/80 flex flex-col lg:flex-row">
        
        {/* ========================================================================= */}
        {/* DESKTOP SLIDING GLASS SHOWCASE PANEL                                       */}
        {/* Hardware-accelerated 60-120fps ease-out cubic bezier                      */}
        {/* Featuring GIF animations in compact cards                                 */}
        {/* ========================================================================= */}
        <div 
          className="hidden lg:flex absolute left-0 top-0 bottom-0 w-1/2 z-30 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] p-6 xl:p-7 flex-col justify-between overflow-hidden shadow-2xl rounded-[34px]"
          style={{
            transform: isSignUp ? 'translate3d(100%, 0, 0)' : 'translate3d(0, 0, 0)',
            willChange: 'transform',
            background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.95) 0%, rgba(37, 99, 235, 0.92) 45%, rgba(79, 70, 229, 0.96) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: isSignUp 
              ? '-14px 0 30px -5px rgba(15, 23, 42, 0.22), inset 1px 0 0 rgba(255, 255, 255, 0.35)' 
              : '14px 0 30px -5px rgba(15, 23, 42, 0.22), inset -1px 0 0 rgba(255, 255, 255, 0.35)'
          }}
        >
          {/* Glass Specular Glare & Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/20 pointer-events-none"></div>
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-sky-300/20 rounded-full blur-2xl pointer-events-none"></div>

          {/* Top Row in Glass Panel */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 p-1.5 shadow-md flex items-center justify-center">
                <img src="/logo.png" alt="Ideate" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-black text-white tracking-tight">Ideate</span>
            </div>

            <div className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[10px] font-bold text-white/95 shadow-xs">
              {isSignUp ? 'New Member' : 'Welcome Back'}
            </div>
          </div>

          {/* Center Showcase Area with High-Impact GIF Animations */}
          <div className="relative z-10 my-auto space-y-4">
            {/* Featured GIF Animation Card */}
            <div className="w-full max-w-[280px] bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl shadow-blue-950/20 border border-white/60 mx-auto">
              <div className="relative rounded-xl overflow-hidden bg-slate-950/5 aspect-[4/3] flex items-center justify-center shadow-inner border border-slate-100">
                <img 
                  src={isSignUp ? "/idea-flow-animation.gif" : "/brain-eating-books.gif"} 
                  alt={isSignUp ? "Idea flow animation" : "Continuous learning animation"} 
                  className="w-full h-full object-cover rounded-xl"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-bold shadow-xs flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isSignUp ? 'Ideas in Motion' : 'Feed Your Mind'}</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">
                    {isSignUp ? 'Ideas in Motion' : 'Feed Your Mind'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {isSignUp 
                      ? 'Capture, refine, and collaborate in real-time spaces.' 
                      : 'Transform your thoughts into structured projects.'}
                  </p>
                </div>
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Compact Security Pill Card */}
            <div className="w-full max-w-[280px] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg shadow-blue-950/15 border border-white/50 mx-auto">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-slate-900 leading-tight">Your data, your rules</div>
                  <p className="text-[9px] text-slate-500 leading-tight">Row Level Security protected.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Switcher Callout in Glass Panel */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-white/90 font-medium pt-3 border-t border-white/20">
            <span>{isSignUp ? 'Already have an account?' : 'Need an Ideate space?'}</span>
            <button
              type="button"
              onClick={() => handleModeSwitch(!isSignUp)}
              className="px-3.5 py-1 rounded-full bg-white text-blue-700 font-bold hover:bg-blue-50 transition shadow-sm active:scale-95 flex items-center gap-1"
            >
              <span>{isSignUp ? 'Sign In' : 'Sign Up'}</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE SEGMENTED SLIDER (Visible on < lg screens)                          */}
        {/* ========================================================================= */}
        <div className="lg:hidden p-4 pb-0 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <img src="/logo.png" alt="Ideate" className="w-5 h-5 object-contain" />
              </div>
              <span className="text-sm font-extrabold text-slate-900">Ideate</span>
            </div>
            <div className="text-xs font-semibold text-slate-400">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </div>
          </div>

          <div className="relative p-1 bg-slate-100 rounded-full flex items-center border border-slate-200">
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                isSignUp ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`relative z-10 w-1/2 py-1.5 text-xs font-bold text-center transition-colors ${
                !isSignUp ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`relative z-10 w-1/2 py-1.5 text-xs font-bold text-center transition-colors ${
                isSignUp ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FORM PANEL 1: SIGN UP (Left 50%)                                           */}
        {/* ========================================================================= */}
        <div 
          className={`w-full lg:w-1/2 p-5 sm:p-7 flex flex-col justify-between bg-white transition-opacity duration-300 ${
            isSignUp 
              ? 'opacity-100 pointer-events-auto flex' 
              : 'lg:opacity-0 lg:pointer-events-none hidden lg:flex'
          }`}
        >
          {pendingVerification ? (
            /* ===================================================================== */
            /* EMAIL CONFIRMATION WAITING STATE (Post-Signup verification)          */
            /* ===================================================================== */
            <div className="my-auto py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mx-auto flex items-center justify-center shadow-sm relative">
                <MailCheck className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Check your email</h2>
                <p className="text-xs text-slate-500 mt-1">
                  We've sent a verification link to:
                </p>
                <div className="inline-block mt-1 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-800 border border-slate-200">
                  {pendingVerification.email}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-[11px] text-slate-600 text-left leading-relaxed space-y-1.5">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Automatic verification detection:</span>
                </p>
                <p>
                  Click the confirmation link in your inbox. This page is automatically listening and will <strong>log you in directly</strong> the moment your email is confirmed!
                </p>
              </div>

              {resendStatus && (
                <div className="text-xs font-semibold text-blue-600 bg-blue-50 py-1.5 px-3 rounded-lg">
                  {resendStatus}
                </div>
              )}
              {error && (
                <div className="text-xs font-semibold text-rose-600 bg-rose-50 py-1.5 px-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Action Buttons for Confirmation */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleManualCheckConfirmation}
                  disabled={loading}
                  className="w-full h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>I've Confirmed — Enter Ideate</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    className="text-slate-500 hover:text-slate-800 font-semibold underline"
                  >
                    Resend email
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingVerification(null);
                      setIsSignUp(false);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ===================================================================== */
            /* STANDARD SIGN UP FORM                                                 */
            /* ===================================================================== */
            <div>
              {/* Header Row: Back button & Switch Link */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => onBack ? onBack() : handleModeSwitch(false)}
                  className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-xs"
                  title="Switch to Sign In"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>

                <div className="text-xs text-slate-500 font-medium">
                  Already member?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(false)}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1"
                  >
                    Sign in
                  </button>
                </div>
              </div>

              {/* Title Section with Hand-drawn Doodle Arrow */}
              <div className="relative mb-4">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Sign Up
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Secure Your Communications with Ideate
                </p>

                {/* Hand-drawn accent curved doodle arrow */}
                <svg className="absolute -top-1 left-28 w-7 h-7 text-slate-700 stroke-current opacity-70 hidden sm:block" viewBox="0 0 36 36" fill="none">
                  <path d="M 6 24 C 14 30 28 26 28 10 M 28 10 L 21 11 M 28 10 L 29 17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Alerts */}
              {error && isSignUp && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-tight">
                  {error}
                </div>
              )}
              {success && isSignUp && (
                <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2 leading-tight">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* Sign Up Form with reduced vertical height */}
              <form onSubmit={handleSignUp} className="space-y-3">
                {/* Full Name */}
                <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  {isNameValid && (
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Email Address */}
                <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  {isEmailValid && (
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Password Checklist */}
                {password && (
                  <div className="space-y-0.5 pt-0.5 pl-1 text-[10px] font-medium text-slate-500">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      <span>Least 6 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumberOrSymbol ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      <span>Least one number (0–9) or symbol</span>
                    </div>
                  </div>
                )}

                {/* Re-Type Password */}
                <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-Type Password"
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  {passwordsMatch && (
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Action Button & Social Login Row */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/25 transition-all flex items-center gap-2.5 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span>Sign Up</span>
                        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                          <ArrowRight className="w-2.5 h-2.5" />
                        </div>
                      </>
                    )}
                  </button>

                  <span className="text-xs font-medium text-slate-400">Or</span>

                  {/* Social Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSocialAuth('facebook')}
                      disabled={Boolean(socialLoading)}
                      className="w-8 h-8 rounded-full border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-center transition shadow-2xs"
                      title="Sign up with Facebook"
                    >
                      <svg className="w-3.5 h-3.5 fill-[#1877F2]" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSocialAuth('google')}
                      disabled={Boolean(socialLoading)}
                      className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center transition shadow-2xs"
                      title="Sign up with Google"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.98 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </form>

              {/* USER SWAP 1: In Sign Up page, show "Ideas waiting to break out" */}
              <div className="mt-3.5 p-2.5 rounded-2xl bg-sky-50/80 border border-sky-100 flex items-center gap-3 shadow-2xs">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-2xs flex-shrink-0 border border-sky-100/70 p-0.5">
                  <img 
                    src="/idea-needs-to-break-out-animation.gif" 
                    alt="Ideas waiting to break out" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-800">Ideas waiting to break out?</div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Sign up to turn creative thoughts into actionable reality.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer language indicator */}
          <div className="mt-3 pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="text-sm">🇬🇧</span>
            <span>ENG</span>
            <span className="text-[9px]">⌃</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FORM PANEL 2: SIGN IN (Right 50%)                                          */}
        {/* ========================================================================= */}
        <div 
          className={`w-full lg:w-1/2 p-5 sm:p-7 flex flex-col justify-between bg-white transition-opacity duration-300 ${
            !isSignUp 
              ? 'opacity-100 pointer-events-auto flex' 
              : 'lg:opacity-0 lg:pointer-events-none hidden lg:flex'
          }`}
        >
          <div>
            {/* Header Row: Back button & Switch Link */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => onBack ? onBack() : handleModeSwitch(true)}
                className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-xs"
                title="Switch to Sign Up"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>

              <div className="text-xs text-slate-500 font-medium">
                New to Ideate?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch(true)}
                  className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1"
                >
                  Sign up
                </button>
              </div>
            </div>

            {/* Title Section with Hand-drawn Doodle Arrow */}
            <div className="relative mb-4">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Sign In
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Access your collaborative spaces and idea timelines
              </p>

              {/* Hand-drawn accent curved doodle arrow */}
              <svg className="absolute -top-1 left-24 w-7 h-7 text-slate-700 stroke-current opacity-70 hidden sm:block" viewBox="0 0 36 36" fill="none">
                <path d="M 6 24 C 14 30 28 26 28 10 M 28 10 L 21 11 M 28 10 L 29 17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Alerts */}
            {error && !isSignUp && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-tight">
                {error}
              </div>
            )}
            {success && !isSignUp && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2 leading-tight">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Sign In Form with reduced vertical height */}
            <form onSubmit={handleSignIn} className="space-y-3.5">
              {/* Email Address */}
              <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {isEmailValid && (
                  <div className="w-3.5 h-3.5 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2 h-2 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="border-b border-slate-200 focus-within:border-blue-600 pb-1.5 flex items-center gap-2.5 transition-colors">
                <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Remember me</span>
                </label>

                <a 
                  href="#forgot" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (!email) {
                      setError('Enter your email address above to receive password reset instructions.');
                    } else {
                      alert(`Password reset instructions sent to ${email}.`);
                    }
                  }}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Action Button & Social Login Row */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-6 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/25 transition-all flex items-center gap-2.5 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <ArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </>
                  )}
                </button>

                <span className="text-xs font-medium text-slate-400">Or</span>

                {/* Social Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('facebook')}
                    disabled={Boolean(socialLoading)}
                    className="w-8 h-8 rounded-full border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-center transition shadow-2xs"
                    title="Sign in with Facebook"
                  >
                    <svg className="w-3.5 h-3.5 fill-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('google')}
                    disabled={Boolean(socialLoading)}
                    className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center transition shadow-2xs"
                    title="Sign in with Google"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.98 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </form>

            {/* USER SWAP 2: In Login page, show "Feed Your Curiosity" featuring public/brain.gif */}
            <div className="mt-3.5 p-2.5 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-2xs flex-shrink-0 border border-blue-100/70 p-0.5">
                <img 
                  src="/brain.gif" 
                  alt="Feed your curiosity" 
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-800">Feed Your Curiosity</div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                  Sign in to collaborate, record voice notes, and bring ideas to life.
                </div>
              </div>
            </div>
          </div>

          {/* Footer language indicator */}
          <div className="mt-3 pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="text-sm">🇬🇧</span>
            <span>ENG</span>
            <span className="text-[9px]">⌃</span>
          </div>
        </div>

      </div>
    </div>
  );
}
