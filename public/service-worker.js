// ==============================================================================
// Ideate — Progressive Web App & Web Push Service Worker
// Handles background push events, system notifications, and click navigation
// ==============================================================================

const CACHE_NAME = 'ideate-pwa-v1';

// Install event — activate worker immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event — claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

// ==============================================================================
// 1. PUSH EVENT HANDLER
// Triggered when browser receives an encrypted Web Push message from the push server
// ==============================================================================
self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { body: event.data.text() };
      } catch (_) {
        data = {};
      }
    }
  }

  // Privacy-preserving defaults
  const title = data.title || 'New activity in Ideate';
  const body = data.body || data.message || 'Someone posted in your discussion. Tap to view.';
  const ideaId = data.ideaId || data.idea_id || null;
  const postId = data.postId || data.post_id || null;
  const targetUrl = data.url || (ideaId ? `/?ideaId=${ideaId}` : '/');

  const options = {
    body,
    icon: data.icon || '/icons/notification-icon.png',
    badge: data.badge || '/icons/notification-badge.png',
    tag: data.tag || (ideaId ? `idea-${ideaId}` : 'ideate-general'),
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: targetUrl,
      ideaId,
      postId,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open Discussion' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ==============================================================================
// 2. NOTIFICATION CLICK HANDLER
// Opens or focuses Ideate and routes directly to the discussion
// ==============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';
  const ideaId = notificationData.ideaId;

  event.waitUntil(
    (async () => {
      // Find all active browser windows of this app
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      // If a window is already open, focus it and tell it to navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          if (ideaId) {
            client.postMessage({
              type: 'NAVIGATE_IDEA',
              ideaId,
              targetUrl
            });
          }
          return;
        }
      }

      // If no window is currently open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ==============================================================================
// 3. BACKGROUND MESSAGE LISTENER
// Allows the frontend app to communicate directly with the service worker
// ==============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
