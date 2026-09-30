import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Send,
  Info,
  Loader2,
  Trash2,
  MessageSquare,
  AtSign,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function NotificationSettings({ compact = false }) {
  const {
    isSupported,
    platformDiagnostics,
    permission,
    isSubscribed,
    devices,
    preferences,
    loading,
    error,
    deviceLabel,
    subscribe,
    unsubscribe,
    removeDevice,
    updatePreferences,
    sendTest,
    refreshStatus
  } = usePushNotifications();

  const [actionLoading, setActionLoading] = useState(false);
  const [delayedTestCountdown, setDelayedTestCountdown] = useState(0);
  const [removingEndpoint, setRemovingEndpoint] = useState(null);
  const [showDevices, setShowDevices] = useState(!compact);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showNotice = (msg, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage('');
    } else {
      setSuccessMessage(msg);
      setErrorMessage('');
    }
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 6000);
  };

  const handleTogglePush = async () => {
    setActionLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      if (isSubscribed) {
        await unsubscribe();
        showNotice('Push notifications disabled for this device.');
      } else {
        await subscribe();
        showNotice('Push notifications enabled! You will now receive alerts even when Ideate is closed.');
      }
    } catch (err) {
      showNotice(err.message || 'Could not update push notification status.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePreference = async (key) => {
    try {
      const nextValue = !preferences[key];
      await updatePreferences({ [key]: nextValue });
    } catch (err) {
      showNotice('Failed to save preference.', true);
    }
  };

  const handleRemoveDevice = async (device) => {
    if (!device?.endpoint) return;
    setRemovingEndpoint(device.endpoint);
    try {
      await removeDevice(device.endpoint);
      showNotice(`Removed "${device.device_name || 'device'}" from push notifications.`);
    } catch (err) {
      showNotice(err.message || 'Failed to remove device.', true);
    } finally {
      setRemovingEndpoint(null);
    }
  };

  const handleInstantTest = async () => {
    setActionLoading(true);
    try {
      await sendTest({ delayMs: 0 });
      showNotice('Test notification sent! Check your system notification tray.');
    } catch (err) {
      showNotice(err.message || 'Failed to send test notification.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackgroundTest = async () => {
    if (delayedTestCountdown > 0) return;
    setDelayedTestCountdown(5);
    showNotice('Minimize or close this window now — a push notification will arrive in 5 seconds!');

    const interval = setInterval(() => {
      setDelayedTestCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      await sendTest({ delayMs: 5000 });
    } catch (err) {
      clearInterval(interval);
      setDelayedTestCountdown(0);
      showNotice(err.message || 'Failed to send background test notification.', true);
    }
  };

  const formatLastUsed = (iso) => {
    if (!iso) return 'Recently active';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Active just now';
    if (mins < 60) return `Active ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `Active ${days}d ago`;
  };

  // True push state reflects actual browser permission AND active PushManager subscription
  const isActuallyEnabled = isSupported && permission === 'granted' && isSubscribed;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/85 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Notification settings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage how Ideate reaches you
            </p>
          </div>
        </div>

        {/* Actual Browser + Subscription Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {!isSupported ? (
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
              {platformDiagnostics.requiresHomeScreen ? 'Requires Home Screen App' : 'Unsupported Browser'}
            </span>
          ) : permission === 'denied' ? (
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              Blocked in Browser
            </span>
          ) : isActuallyEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Enabled
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {(errorMessage || error) && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage || error}</span>
        </div>
      )}

      {/* Platform / Permission Troubleshooting Banners */}
      {!isSupported && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              {platformDiagnostics.requiresHomeScreen
                ? 'Install Ideate to your iPhone/iPad Home Screen for Web Push'
                : 'Web Push is not available in this browser tab'}
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {platformDiagnostics.requiresHomeScreen
                ? 'On iOS/iPadOS, background Web Push requires launching Ideate as a Home Screen app. Tap the Share icon in Safari, choose "Add to Home Screen", then open Ideate from your Home Screen and enable Push Notifications here.'
                : 'Use a supported browser (Chrome, Edge, Firefox, or Safari 16.4+) or install Ideate as a Progressive Web App (PWA) to receive background notifications.'}
            </p>
          </div>
        </div>
      )}

      {isSupported && permission === 'denied' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Browser notification permission is blocked</p>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              Click the lock/tune icon in your browser address bar (or open your OS Notification Settings for this app), set <strong>Notifications</strong> to <strong>Allow</strong>, and refresh the page.
            </p>
          </div>
        </div>
      )}

      {/* Settings Rows */}
      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/40">
        {/* 1. Push Notifications Row */}
        <div className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Push notifications</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActuallyEnabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isActuallyEnabled ? 'Enabled' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Receive alerts even when Ideate is closed ({deviceLabel || 'this device'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isActuallyEnabled && (
              <>
                <button
                  type="button"
                  onClick={handleInstantTest}
                  disabled={actionLoading || loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                  title="Send an immediate test push notification"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Test Push</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackgroundTest}
                  disabled={actionLoading || loading || delayedTestCountdown > 0}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition flex items-center gap-1.5"
                  title="Sends a server push after 5 seconds so you can minimize or close the app to verify background delivery"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {delayedTestCountdown > 0
                      ? `Sending in ${delayedTestCountdown}s...`
                      : '5s Closed-App Test'}
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleTogglePush}
              disabled={actionLoading || loading || !isSupported || permission === 'denied'}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 ${
                isActuallyEnabled
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : isActuallyEnabled ? (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Disable</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable Push</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. New Messages Preference Row */}
        <div className="p-4 sm:p-5 bg-white flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">New messages</p>
              <p className="text-xs text-slate-500">
                When a member posts in a shared idea
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={preferences.new_messages !== false}
            onClick={() => handleTogglePreference('new_messages')}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              preferences.new_messages !== false ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                preferences.new_messages !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 3. Mentions Preference Row */}
        <div className="p-4 sm:p-5 bg-white flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AtSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Mentions</p>
              <p className="text-xs text-slate-500">
                When someone mentions you or @replies to you
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={preferences.mentions !== false}
            onClick={() => handleTogglePreference('mentions')}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              preferences.mentions !== false ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                preferences.mentions !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 4. Device Management Row */}
        <div className="p-4 sm:p-5 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">Device management</p>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    {devices.length} {devices.length === 1 ? 'device' : 'devices'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  View and remove registered devices
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshStatus}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Refresh registered devices"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowDevices((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>Manage</span>
                {showDevices ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Registered Devices List */}
          {showDevices && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
              {devices.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-center">
                  <p className="text-xs font-semibold text-slate-600">
                    No devices registered for background push notifications yet.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &ldquo;Enable Push&rdquo; above on any phone or computer where you want to receive alerts.
                  </p>
                </div>
              ) : (
                devices.map((dev) => {
                  const isMobile = /iOS|Android|iPhone|iPad/i.test(dev.device_name || '');
                  const isRemoving = removingEndpoint === dev.endpoint;
                  return (
                    <div
                      key={dev.endpoint}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/90 border border-slate-200/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 flex-shrink-0">
                          {isMobile ? (
                            <Smartphone className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Laptop className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {dev.device_name || 'Web Browser'}
                            </span>
                            {dev.isCurrentDevice && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                This device
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatLastUsed(dev.last_used_at)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(dev)}
                        disabled={isRemoving}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                        title="Remove this device subscription"
                      >
                        {isRemoving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Remove</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
