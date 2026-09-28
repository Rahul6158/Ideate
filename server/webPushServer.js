import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const STORAGE_FILE = path.resolve(process.cwd(), '.push_subscriptions_dev.json');

// Auto-load variables from .env if not already loaded into process.env
function loadLocalEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch (_) {}
}
loadLocalEnv();

// Helper to read local dev subscriptions
export function getStoredSubscriptions() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.warn('[WebPush Server] Error reading local subscriptions:', err.message);
  }
  return [];
}

// Helper to save local dev subscriptions
export function saveSubscription(sub) {
  try {
    const list = getStoredSubscriptions().filter(s => s.endpoint !== sub.endpoint);
    list.push({
      ...sub,
      updated_at: new Date().toISOString()
    });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[WebPush Server] Error saving local subscription:', err.message);
    return false;
  }
}

// Configure VAPID keys
export function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@ideate.app';

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  }
  return false;
}

// Send Web Push notification to recipient user IDs
export async function sendWebPushNotification({
  recipientIds = [],
  ideaId = null,
  postId = null,
  title = 'New activity in Ideate',
  body = 'Someone posted in your discussion. Tap to view.',
  authorId = null
}) {
  const isConfigured = configureVapid();
  if (!isConfigured) {
    console.warn('[WebPush Server] VAPID keys not configured in environment.');
    return { delivered: 0, reason: 'VAPID keys not configured' };
  }

  // 1. Gather subscriptions for recipients from local storage
  const localSubs = getStoredSubscriptions().filter(s => recipientIds.includes(s.user_id));

  // 2. Also query Supabase push_subscriptions table if available
  let remoteSubs = [];
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', recipientIds);
      if (Array.isArray(data)) {
        remoteSubs = data;
      }
    } catch (_) {
      // Table may not exist yet in database
    }
  }

  // Combine and deduplicate subscriptions by endpoint
  const subMap = new Map();
  [...localSubs, ...remoteSubs].forEach(s => {
    if (s && s.endpoint && s.p256dh && s.auth) {
      subMap.set(s.endpoint, s);
    }
  });

  const allSubscriptions = Array.from(subMap.values());
  if (allSubscriptions.length === 0) {
    return { delivered: 0, recipientCount: recipientIds.length, message: 'No registered push subscriptions found for recipients' };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    tag: ideaId ? `idea-${ideaId}` : 'ideate-general',
    data: {
      url: ideaId ? `/?ideaId=${ideaId}` : '/',
      ideaId,
      postId,
      authorId
    }
  });

  let deliveredCount = 0;
  const expiredEndpoints = [];

  await Promise.all(
    allSubscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, payload);
        deliveredCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn('[WebPush Server] Push delivery error:', err.message);
        }
      }
    })
  );

  // Clean up expired local endpoints
  if (expiredEndpoints.length > 0) {
    try {
      const remaining = getStoredSubscriptions().filter(s => !expiredEndpoints.includes(s.endpoint));
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(remaining, null, 2), 'utf8');
    } catch (_) {}
  }

  return {
    delivered: deliveredCount,
    totalAttempted: allSubscriptions.length,
    recipientCount: recipientIds.length
  };
}
