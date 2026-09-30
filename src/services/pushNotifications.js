// ==============================================================================
// Ideate — Web Push Notifications & Device Subscription Service
// Manages /sw.js registration, VAPID PushManager subscriptions, multi-device
// management, notification preferences, and background delivery verification.
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BCiGsNOlFD30TkiVoUkFpC3LO67yms12X4rYfSB3qeKGYhFvxOvLaGUiwfEIV4VAUf776DYvOlXVQfhKsTLYqEU';

const PREFS_STORAGE_PREFIX = 'ideate_push_prefs_v1_';

// Convert base64 URL-safe string to Uint8Array for PushManager.subscribe()
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {}
  }
  return headers;
}

export const pushNotificationService = {
  /**
   * Determine if the current browser and platform supports Web Push
   */
  isPushSupported() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /**
   * Detect iOS browser tab vs installed Home Screen PWA
   */
  getPlatformDiagnostics() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { isIOS: false, isAndroid: false, isStandalone: false, requiresHomeScreen: false };
    }
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isStandalone =
      Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches) ||
      Boolean(navigator.standalone);

    return {
      isIOS,
      isAndroid,
      isStandalone,
      requiresHomeScreen: isIOS && !isStandalone
    };
  },

  /**
   * Get current notification permission state: 'default' | 'granted' | 'denied' | 'unsupported'
   */
  getPermissionState() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  /**
   * Register the root-scoped Service Worker (/sw.js)
   */
  async registerServiceWorker() {
    if (!this.isPushSupported()) return null;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (err) {
      console.warn('[Push] Service worker registration error:', err);
      return null;
    }
  },

  /**
   * Get the active service worker registration
   */
  async getRegistration() {
    if (!this.isPushSupported()) return null;
    try {
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        reg = await this.registerServiceWorker();
      }
      return reg || (await navigator.serviceWorker.ready);
    } catch {
      return null;
    }
  },

  /**
   * Check if this browser is currently subscribed to push notifications
   */
  async getSubscription() {
    if (!this.isPushSupported()) return null;
    try {
      const reg = await this.getRegistration();
      if (!reg) return null;
      return await reg.pushManager.getSubscription();
    } catch (err) {
      console.warn('[Push] Failed to check existing subscription:', err);
      return null;
    }
  },

  /**
   * Generate a human-readable device name (e.g., "Chrome on Windows", "Safari on iOS (PWA)")
   */
  getDeviceLabel() {
    if (typeof navigator === 'undefined') return 'Web Browser';
    const ua = navigator.userAgent;

    let os = 'Desktop';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Browser';
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone;
    return `${browser} on ${os}${isStandalone ? ' (PWA)' : ''}`;
  },

  /**
   * Read user notification preferences (new_messages, mentions, muted_ideas)
   */
  getPreferences(userId) {
    const defaults = {
      push_enabled: true,
      new_messages: true,
      mentions: true,
      muted_ideas: []
    };
    if (typeof window === 'undefined' || !userId) return defaults;
    try {
      const raw = localStorage.getItem(`${PREFS_STORAGE_PREFIX}${userId}`);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        muted_ideas: Array.isArray(parsed?.muted_ideas) ? parsed.muted_ideas : []
      };
    } catch (_) {
      return defaults;
    }
  },

  /**
   * Update user notification preferences and sync with server vault
   */
  async updatePreferences(userId, partialPrefs) {
    const current = this.getPreferences(userId);
    const updated = {
      ...current,
      ...partialPrefs,
      muted_ideas: Array.isArray(partialPrefs?.muted_ideas)
        ? partialPrefs.muted_ideas
        : current.muted_ideas
    };

    if (typeof window !== 'undefined' && userId) {
      try {
        localStorage.setItem(`${PREFS_STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
      } catch (_) {}
    }

    if (userId) {
      try {
        const headers = await getAuthHeaders();
        await fetch('/api/register-push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userId,
            preferences: updated
          })
        });
      } catch (_) {}
    }

    return updated;
  },

  /**
   * Toggle mute status for a specific idea
   */
  async toggleMuteIdea(userId, ideaId) {
    if (!userId || !ideaId) return this.getPreferences(userId);
    const prefs = this.getPreferences(userId);
    const isMuted = prefs.muted_ideas.includes(ideaId);
    const nextMuted = isMuted
      ? prefs.muted_ideas.filter((id) => id !== ideaId)
      : [...prefs.muted_ideas, ideaId];
    return await this.updatePreferences(userId, { muted_ideas: nextMuted });
  },

  isIdeaMuted(userId, ideaId) {
    if (!userId || !ideaId) return false;
    const prefs = this.getPreferences(userId);
    return prefs.muted_ideas.includes(ideaId);
  },

  /**
   * Subscribe user device to Web Push following explicit user action
   */
  async subscribeUser(userId) {
    if (!userId) {
      throw new Error('Please sign in to enable push notifications.');
    }

    const diag = this.getPlatformDiagnostics();
    if (diag.requiresHomeScreen) {
      throw new Error(
        'On iPhone/iPad, tap Share and select "Add to Home Screen", then open Ideate from your Home Screen to enable Push Notifications.'
      );
    }

    if (!this.isPushSupported()) {
      throw new Error('Web Push notifications are not supported on this browser or device.');
    }

    // 1. Request notification permission (must be triggered by user action)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(
        permission === 'denied'
          ? 'Notification permission was blocked. Please allow notifications for this site in your browser settings.'
          : 'Notification permission request was dismissed.'
      );
    }

    // 2. Register and await root-scoped Service Worker (/sw.js)
    const registration = await this.registerServiceWorker();
    const readyRegistration = registration || (await navigator.serviceWorker.ready);
    if (!readyRegistration) {
      throw new Error('Could not initialize the background service worker (/sw.js).');
    }

    // 3. Obtain VAPID Public Key
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

    // 4. Subscribe through PushManager
    let subscription = await readyRegistration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    // 5. Persist subscription to Supabase and backend
    await this._persistSubscriptionRecord(userId, subscription);

    // Ensure push_enabled is marked true in preferences
    await this.updatePreferences(userId, { push_enabled: true });

    return subscription;
  },

  /**
   * Internal helper to persist a PushSubscription object to DB, Edge Function, and API vault
   */
  async _persistSubscriptionRecord(userId, subscription) {
    if (!userId || !subscription) return null;

    const rawP256dh = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');
    const p256dh = arrayBufferToBase64(rawP256dh);
    const auth = arrayBufferToBase64(rawAuth);
    const endpoint = subscription.endpoint;
    const deviceLabel = this.getDeviceLabel();
    const preferences = this.getPreferences(userId);
    const nowIso = new Date().toISOString();

    // 1. Upsert directly into Supabase push_subscriptions table (protected by RLS auth.uid() = user_id)
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint,
              p256dh,
              auth,
              device_label: deviceLabel,
              last_used_at: nowIso
            },
            { onConflict: 'endpoint' }
          );

        if (error) {
          console.warn('[Push] Supabase push_subscriptions upsert notice:', error.message);
        }
      } catch (err) {
        console.warn('[Push] Failed to upsert push_subscriptions:', err);
      }

      // 2. Also try Supabase Edge Function register-push if deployed
      supabase.functions
        .invoke('register-push', {
          body: {
            endpoint,
            p256dh,
            auth,
            device_name: deviceLabel,
            device_label: deviceLabel
          }
        })
        .catch(() => {});
    }

    // 3. Register with backend API (/api/register-push) which also updates the AES-256-GCM encrypted server vault
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/register-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          device_name: deviceLabel,
          device_label: deviceLabel,
          preferences
        })
      });
    } catch (apiErr) {
      console.warn('[Push] /api/register-push sync notice:', apiErr.message);
    }

    localStorage.setItem('ideate_push_enabled_v1', 'true');
    localStorage.setItem('ideate_push_endpoint_v1', endpoint);

    return {
      endpoint,
      device_label: deviceLabel,
      last_used_at: nowIso
    };
  },

  /**
   * Silently synchronize an existing browser subscription on app startup
   */
  async syncSubscription(userId) {
    if (!userId || !this.isPushSupported()) return null;
    try {
      if (Notification.permission !== 'granted') return null;
      const sub = await this.getSubscription();
      if (!sub) return null;

      await this._persistSubscriptionRecord(userId, sub);
      return sub;
    } catch (err) {
      console.warn('[Push] Subscription sync failed:', err);
      return null;
    }
  },

  /**
   * Fetch all registered devices for the authenticated user from Supabase
   */
  async getUserDevices(userId) {
    if (!userId) return [];
    const currentSub = await this.getSubscription();
    const currentEndpoint = currentSub?.endpoint || localStorage.getItem('ideate_push_endpoint_v1') || null;

    let devices = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id, user_id, endpoint, device_label, created_at, last_used_at')
          .eq('user_id', userId)
          .order('last_used_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          devices = data.map((row) => ({
            id: row.id,
            endpoint: row.endpoint,
            device_name: row.device_label || 'Web Browser',
            device_label: row.device_label || 'Web Browser',
            created_at: row.created_at,
            last_used_at: row.last_used_at || row.created_at,
            isCurrentDevice: Boolean(currentEndpoint && row.endpoint === currentEndpoint)
          }));
        }
      } catch (err) {
        console.warn('[Push] Error loading user devices:', err);
      }
    }

    // If current browser has an active subscription not yet in the list, include it
    if (currentSub && !devices.some((d) => d.endpoint === currentSub.endpoint)) {
      devices.unshift({
        id: 'local-current',
        endpoint: currentSub.endpoint,
        device_name: this.getDeviceLabel(),
        device_label: this.getDeviceLabel(),
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        isCurrentDevice: true
      });
    }

    return devices;
  },

  /**
   * Remove a specific registered device subscription
   */
  async removeDevice(userId, targetEndpoint) {
    if (!targetEndpoint) return false;

    const currentSub = await this.getSubscription();
    const isRemovingCurrent = currentSub && currentSub.endpoint === targetEndpoint;

    if (isRemovingCurrent) {
      return await this.unsubscribeUser(userId);
    }

    // Remove remote device from Supabase push_subscriptions
    if (isSupabaseConfigured && supabase && userId) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', targetEndpoint);
      } catch (_) {}

      supabase.functions
        .invoke('delete-push', {
          body: { endpoint: targetEndpoint }
        })
        .catch(() => {});
    }

    // Remove from server vault
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/delete-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          endpoint: targetEndpoint
        })
      });
    } catch (_) {}

    return true;
  },

  /**
   * Unsubscribe the current device from Web Push
   */
  async unsubscribeUser(userId) {
    let endpoint = localStorage.getItem('ideate_push_endpoint_v1');

    try {
      const sub = await this.getSubscription();
      if (sub) {
        endpoint = sub.endpoint || endpoint;
        await sub.unsubscribe();
      }
    } catch (err) {
      console.warn('[Push] Unsubscribe error:', err);
    }

    if (endpoint && isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      } catch (err) {
        console.warn('[Push] Failed to delete subscription record:', err);
      }

      supabase.functions
        .invoke('delete-push', {
          body: { endpoint }
        })
        .catch(() => {});
    }

    if (endpoint) {
      try {
        const headers = await getAuthHeaders();
        await fetch('/api/delete-push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userId,
            endpoint
          })
        });
      } catch (_) {}
    }

    localStorage.removeItem('ideate_push_enabled_v1');
    localStorage.removeItem('ideate_push_endpoint_v1');

    return true;
  },

  /**
   * Send a test notification (supports optional delayMs so user can close/lock app to test background delivery)
   */
  async sendTestNotification(userId = null, { delayMs = 0 } = {}) {
    if (!this.isPushSupported()) {
      throw new Error('Notifications are not supported on this browser.');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission has not been granted yet.');
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // 1. Trigger real Web Push from server to all registered devices of this user
    let serverDelivered = false;
    if (userId) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/send-push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recipientIds: [userId],
            title: delayMs > 0 ? 'Ideate Background Push Verified 🔔' : 'Ideate Push Notification 🚀',
            body:
              delayMs > 0
                ? 'Success! Your device received this Web Push notification in the background.'
                : 'Web Push notifications are active and connected for your account.',
            authorId: userId
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.result?.delivered > 0) {
            serverDelivered = true;
          }
        }
      } catch (_) {}
    }

    // 2. If server push did not already trigger the local SW notification, show via SW directly
    if (!serverDelivered) {
      const reg = await this.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification('Ideate Push Notification 🚀', {
          body: 'Service Worker notifications are active on this device!',
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          vibrate: [150, 100, 150],
          tag: 'ideate-test-notification',
          data: {
            url: '/'
          }
        });
      } else {
        new Notification('Ideate Push Notification 🚀', {
          body: 'Notifications are active on this device!',
          icon: '/icons/icon-192.png'
        });
      }
    }

    return true;
  }
};
