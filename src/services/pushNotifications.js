// ==============================================================================
// Ideate — Push Notifications Service
// Manages Service Worker registration, Web Push subscriptions, and device pairing
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper to convert base64 URL-safe string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
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

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
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
   * Get current notification permission state: 'default' | 'granted' | 'denied'
   */
  getPermissionState() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  /**
   * Register the Service Worker (runs on app bootstrap)
   */
  async registerServiceWorker() {
    if (!this.isPushSupported()) return null;

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
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
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  },

  /**
   * Check if this device is currently subscribed to push notifications
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
   * Generate a human-readable device label (e.g., "Chrome on Windows", "Safari on iOS")
   */
  getDeviceLabel() {
    if (typeof navigator === 'undefined') return 'Web Browser';
    const ua = navigator.userAgent;

    let os = 'Unknown OS';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Browser';
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone;
    return `${browser} on ${os}${isStandalone ? ' (PWA)' : ''}`;
  },

  /**
   * Subscribe user device to Web Push
   */
  async subscribeUser(userId) {
    if (!userId) {
      throw new Error('User must be logged in to subscribe to notifications.');
    }

    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported on this browser or platform.');
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(
        permission === 'denied'
          ? 'Notification permission was denied. Please allow notifications in your browser settings.'
          : 'Notification permission request was cancelled.'
      );
    }

    // 2. Ensure Service Worker is ready
    let reg = await this.getRegistration();
    if (!reg) {
      reg = await this.registerServiceWorker();
    }
    if (!reg) {
      throw new Error('Could not initialize service worker.');
    }

    // 3. Obtain VAPID Public Key
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error('VAPID public key is not configured on this environment.');
    }

    // 4. Create PushManager subscription
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // 5. Extract keys
    const rawP256dh = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');
    const p256dh = arrayBufferToBase64(rawP256dh);
    const auth = arrayBufferToBase64(rawAuth);
    const endpoint = subscription.endpoint;
    const deviceLabel = this.getDeviceLabel();

    // 6. Register subscription with local dev server / Vercel API endpoint
    try {
      await fetch('/api/register-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          device_label: deviceLabel
        })
      });
    } catch (apiErr) {
      console.warn('[Push] Error registering with /api/register-push:', apiErr.message);
    }

    // 7. Save in Supabase database
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            device_label: deviceLabel,
            last_used_at: new Date().toISOString()
          }, { onConflict: 'endpoint' });

        if (error) {
          console.warn('[Push] Error storing subscription in database:', error.message);
        }
      } catch (err) {
        console.warn('[Push] Failed to upsert subscription:', err);
      }
    }

    // 8. Store locally for offline awareness
    localStorage.setItem('ideate_push_enabled_v1', 'true');
    localStorage.setItem('ideate_push_endpoint_v1', endpoint);

    return subscription;
  },

  /**
   * Silently synchronize an existing browser subscription with backend endpoints
   */
  async syncSubscription(userId) {
    if (!userId || !this.isPushSupported()) return null;
    try {
      const sub = await this.getSubscription();
      if (!sub) return null;

      const rawP256dh = sub.getKey('p256dh');
      const rawAuth = sub.getKey('auth');
      const p256dh = arrayBufferToBase64(rawP256dh);
      const auth = arrayBufferToBase64(rawAuth);
      const endpoint = sub.endpoint;
      const deviceLabel = this.getDeviceLabel();

      // Sync with API
      try {
        await fetch('/api/register-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            device_label: deviceLabel
          })
        });
      } catch (_) {}

      // Sync with Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('push_subscriptions')
            .upsert({
              user_id: userId,
              endpoint,
              p256dh,
              auth,
              device_label: deviceLabel,
              last_used_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });
        } catch (_) {}
      }

      localStorage.setItem('ideate_push_enabled_v1', 'true');
      localStorage.setItem('ideate_push_endpoint_v1', endpoint);

      return sub;
    } catch (err) {
      console.warn('[Push] Subscription sync failed:', err);
      return null;
    }
  },

  /**
   * Unsubscribe user device from Web Push
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

    // Remove from database
    if (endpoint && isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      } catch (err) {
        console.warn('[Push] Failed to delete subscription record:', err);
      }
    }

    localStorage.removeItem('ideate_push_enabled_v1');
    localStorage.removeItem('ideate_push_endpoint_v1');

    return true;
  },

  /**
   * Send a test notification to verify push delivery on this device
   */
  async sendTestNotification(userId = null) {
    if (!this.isPushSupported()) {
      throw new Error('Notifications are not supported on this browser.');
    }

    const permission = Notification.permission;
    if (permission !== 'granted') {
      throw new Error('Notification permission has not been granted yet.');
    }

    // 1. Instant local/PWA test notification
    const reg = await this.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification('Ideate Notification Test 🚀', {
        body: 'Push notifications are active and ready on this device!',
        icon: '/icons/notification-icon.png',
        badge: '/icons/notification-badge.png',
        vibrate: [150, 100, 150],
        tag: 'ideate-test-notification',
        data: {
          url: '/'
        }
      });
    } else {
      new Notification('Ideate Notification Test 🚀', {
        body: 'Push notifications are active and ready on this device!',
        icon: '/icons/notification-icon.png'
      });
    }

    // 2. Also test backend server push delivery if userId is provided
    if (userId) {
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientIds: [userId],
            title: 'Ideate Server Push Test 🌐',
            body: 'Server push notification was received successfully by your device!',
            authorId: userId
          })
        });
      } catch (_) {}
    }

    return true;
  }
};
