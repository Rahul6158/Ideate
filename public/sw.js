// ==============================================================================
// Ideate — Root-Scoped Web Push Service Worker (/sw.js)
// Receives background Web Push events even when all Ideate tabs are closed,
// displays native OS notifications, deduplicates messages, and routes clicks.
// ==============================================================================

const SW_VERSION = 'ideate-sw-v2';
const recentNotificationIds = new Set();

function rememberNotificationId(id) {
  if (!id) return false;
  if (recentNotificationIds.has(id)) return true;
  recentNotificationIds.add(id);
  if (recentNotificationIds.size > 100) {
    const oldest = recentNotificationIds.values().next().value;
    recentNotificationIds.delete(oldest);
  }
  return false;
}

/**
 * Validate and normalize a target URL so it is strictly same-origin
 */
function resolveSafeUrl(rawUrl, ideaId, postId) {
  const fallbackPath = ideaId
    ? `/?ideaId=${encodeURIComponent(ideaId)}${postId ? `&postId=${encodeURIComponent(postId)}` : ''}`
    : '/';

  try {
    const candidate = new URL(rawUrl || fallbackPath, self.location.origin);
    if (candidate.origin !== self.location.origin) {
      return new URL(fallbackPath, self.location.origin).href;
    }
    return candidate.href;
  } catch (_) {
    return new URL(fallbackPath, self.location.origin).href;
  }
}

// Install event — activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event — claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ==============================================================================
// 1. PUSH EVENT HANDLER
// Invoked by the browser push service even when Ideate is closed
// ==============================================================================
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json() ?? {};
    } catch (_) {
      try {
        data = { body: event.data.text() };
      } catch (__) {
        data = {};
      }
    }
  }

  const nestedData = data.data && typeof data.data === 'object' ? data.data : {};
  const ideaId = data.ideaId || data.idea_id || nestedData.ideaId || nestedData.idea_id || null;
  const postId = data.postId || data.post_id || nestedData.postId || nestedData.post_id || null;
  const dedupeKey = postId ? `post:${postId}` : (data.dedupeKey || nestedData.dedupeKey || null);

  // Prevent duplicate push notifications for the same message ID
  if (dedupeKey && rememberNotificationId(dedupeKey)) {
    return;
  }

  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim()
    : 'New message on Ideate';

  const body = typeof (data.body || data.message) === 'string' && (data.body || data.message).trim()
    ? (data.body || data.message).trim()
    : 'Someone posted in your idea.';

  const safeUrl = resolveSafeUrl(data.url || nestedData.url, ideaId, postId);
  const tag = data.tag || (ideaId ? `ideate-idea-${ideaId}` : 'ideate-message');

  const options = {
    body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
    data: {
      url: safeUrl,
      ideaId,
      postId,
      type: data.type || nestedData.type || 'new_post',
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
// Focuses an existing Ideate window or opens a new one to the target idea
// ==============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const ideaId = notificationData.ideaId || null;
  const postId = notificationData.postId || null;
  const targetUrl = resolveSafeUrl(notificationData.url, ideaId, postId);

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(async (windows) => {
        for (const windowClient of windows) {
          if (windowClient.url && windowClient.url.startsWith(self.location.origin)) {
            // Notify the React app to switch directly to the idea without a full reload if possible
            try {
              windowClient.postMessage({
                type: 'NAVIGATE_IDEA',
                ideaId,
                postId,
                targetUrl
              });
            } catch (_) {}

            if (!ideaId && 'navigate' in windowClient) {
              try {
                await windowClient.navigate(targetUrl);
              } catch (_) {}
            }

            if ('focus' in windowClient) {
              return windowClient.focus();
            }
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ==============================================================================
// 3. PUSH SUBSCRIPTION CHANGE HANDLER
// Handles automatic browser endpoint rotation
// ==============================================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        for (const client of windowClients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            oldEndpoint: event.oldSubscription?.endpoint || null,
            newSubscription: event.newSubscription ? event.newSubscription.toJSON() : null
          });
        }
      } catch (_) {}
    })()
  );
});

// ==============================================================================
// 4. MESSAGE LISTENER
// ==============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
