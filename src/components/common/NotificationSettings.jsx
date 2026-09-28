import React, { useState } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Smartphone, Send, Shield, Info, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    deviceLabel,
    subscribe,
    unsubscribe,
    sendTest
  } = usePushNotifications();

  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleToggle = async () => {
    setActionLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      if (isSubscribed) {
        await unsubscribe();
        setSuccessMessage('Push notifications disabled for this device.');
      } else {
        await subscribe();
        setSuccessMessage('Push notifications enabled successfully! You will receive alerts when team members post.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Could not update notification preferences.');
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
    }
  };

  const handleTest = async () => {
    setActionLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await sendTest();
      setSuccessMessage('Test notification sent! Check your system notification tray.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send test notification.');
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Push Notifications</h3>
            <p className="text-xs text-slate-500">
              Receive instant alerts for new posts and replies even when Ideate is closed.
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex-shrink-0">
          {!isSupported ? (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
              Unsupported
            </span>
          ) : permission === 'denied' ? (
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
              Blocked in Browser
            </span>
          ) : isSubscribed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {(errorMessage || error) && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage || error}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="pt-4 space-y-4">
        {!isSupported ? (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Web Push not supported on this platform</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                If you are on an iPhone or iPad (iOS 16.4+), tap the <strong>Share</strong> button and choose <strong>"Add to Home Screen"</strong>. Opening Ideate from your Home Screen unlocks Web Push support.
              </p>
            </div>
          </div>
        ) : permission === 'denied' ? (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notifications are blocked</p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                To receive alerts, open your browser site settings for this page and change notifications to <strong>Allow</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  Current Device: <span className="font-normal text-slate-600">{deviceLabel || 'This device'}</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  {isSubscribed ? 'Subscribed to background Web Push' : 'Not subscribed on this device'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isSubscribed && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={actionLoading || loading}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                  title="Send a test notification to verify delivery"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Send Test</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggle}
                disabled={actionLoading || loading}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  isSubscribed
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isSubscribed ? (
                  <>
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Disable Push</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Push Notifications</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-slate-600 text-[11px]">
            <span className="font-bold text-slate-800 block mb-0.5">🔒 Private by Default</span>
            Notification contents are sanitized to protect sensitive discussion topics.
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-slate-600 text-[11px]">
            <span className="font-bold text-slate-800 block mb-0.5">📱 Multi-Device</span>
            Pair laptop, desktop, tablet, and mobile devices under the same account.
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-slate-600 text-[11px]">
            <span className="font-bold text-slate-800 block mb-0.5">⚡ Instant Navigation</span>
            Tapping a notification brings you directly into the discussion room.
          </div>
        </div>
      </div>
    </div>
  );
}
