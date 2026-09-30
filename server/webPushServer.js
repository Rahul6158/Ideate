import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const STORAGE_FILE = path.resolve(process.cwd(), '.push_subscriptions_dev.json');
const VAULT_BUCKET = 'idea-attachments';
const VAULT_PREFIX = '_push_vault';

// Auto-load variables from .env if not already loaded into process.env
function loadLocalEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
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

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null;
  return { url, publishableKey, secretKey };
}

function createSupabaseServerClient(accessToken = null) {
  const { url, publishableKey, secretKey } = getSupabaseConfig();
  if (!url || (!publishableKey && !secretKey)) return null;

  // Prefer secret key if available for server operations
  if (secretKey && !accessToken) {
    return createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  const options = {
    auth: { persistSession: false, autoRefreshToken: false }
  };
  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    };
  }
  return createClient(url, publishableKey || secretKey, options);
}

// ============================================================================
// AES-256-GCM Server-Side Encryption (keyed by VAPID_PRIVATE_KEY)
// Ensures subscription endpoints & keys stored in the vault are unreadable
// by any client or non-server party.
// ============================================================================
function getEncryptionKey() {
  const secret = process.env.VAPID_PRIVATE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(`ideate-push-vault:${secret}`).digest();
}

function encryptVaultPayload(dataObj) {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(dataObj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  });
}

function decryptVaultPayload(rawText) {
  const key = getEncryptionKey();
  if (!key || !rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || !parsed.iv || !parsed.tag || !parsed.data) return null;
    const iv = Buffer.from(parsed.iv, 'base64');
    const tag = Buffer.from(parsed.tag, 'base64');
    const encrypted = Buffer.from(parsed.data, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (_) {
    return null;
  }
}

async function readUserVault(userId, supabaseClient = null) {
  const client = supabaseClient || createSupabaseServerClient();
  if (!client || !userId) {
    return { subscriptions: [], preferences: getDefaultPreferences() };
  }
  try {
    const { data, error } = await client.storage
      .from(VAULT_BUCKET)
      .download(`${VAULT_PREFIX}/${userId}.enc`);
    if (error || !data) {
      return { subscriptions: [], preferences: getDefaultPreferences() };
    }
    const rawText = await data.text();
    const decrypted = decryptVaultPayload(rawText);
    if (decrypted && typeof decrypted === 'object') {
      return {
        subscriptions: Array.isArray(decrypted.subscriptions) ? decrypted.subscriptions : [],
        preferences: { ...getDefaultPreferences(), ...(decrypted.preferences || {}) }
      };
    }
  } catch (_) {}
  return { subscriptions: [], preferences: getDefaultPreferences() };
}

async function writeUserVault(userId, vaultData, accessToken = null) {
  const client = createSupabaseServerClient(accessToken) || createSupabaseServerClient();
  if (!client || !userId) return false;
  try {
    const encrypted = encryptVaultPayload({
      user_id: userId,
      subscriptions: vaultData.subscriptions || [],
      preferences: { ...getDefaultPreferences(), ...(vaultData.preferences || {}) },
      updated_at: new Date().toISOString()
    });
    if (!encrypted) return false;
    const { error } = await client.storage
      .from(VAULT_BUCKET)
      .upload(`${VAULT_PREFIX}/${userId}.enc`, encrypted, {
        upsert: true,
        contentType: 'application/json'
      });
    return !error;
  } catch (_) {
    return false;
  }
}

export function getDefaultPreferences() {
  return {
    push_enabled: true,
    new_messages: true,
    mentions: true,
    muted_ideas: []
  };
}

// Helper to read local dev subscriptions (only in local dev where filesystem is writable)
export function getStoredSubscriptions() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(content) || [];
    }
  } catch (_) {}
  return [];
}

function writeLocalSubscriptions(list) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (_) {
    // Expected on read-only serverless filesystems like Vercel
  }
}

// Save or update a push subscription (local dev + encrypted vault + DB if accessible)
export async function saveSubscription(sub, accessToken = null) {
  const userId = sub.user_id;
  const endpoint = sub.endpoint;
  const p256dh = sub.p256dh;
  const auth = sub.auth;
  const deviceLabel = sub.device_name || sub.device_label || 'Web Device';
  const nowIso = new Date().toISOString();

  if (!userId || !endpoint || !p256dh || !auth) {
    return false;
  }

  const record = {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    device_name: deviceLabel,
    device_label: deviceLabel,
    last_used_at: nowIso,
    updated_at: nowIso
  };

  // 1. Save in local dev file if available
  try {
    const list = getStoredSubscriptions().filter((s) => s.endpoint !== endpoint);
    list.push({
      ...record,
      preferences: sub.preferences || undefined
    });
    writeLocalSubscriptions(list);
  } catch (_) {}

  // 2. Save in Supabase push_subscriptions table using user token or secret key
  const dbClient = createSupabaseServerClient(accessToken);
  if (dbClient) {
    try {
      await dbClient
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
    } catch (_) {}
  }

  // 3. Save in AES-256-GCM encrypted server vault so serverless push sender can read it
  try {
    const existingVault = await readUserVault(userId, dbClient);
    const filteredSubs = existingVault.subscriptions.filter((s) => s.endpoint !== endpoint);
    filteredSubs.push(record);
    const nextPreferences = sub.preferences
      ? { ...existingVault.preferences, ...sub.preferences }
      : existingVault.preferences;
    await writeUserVault(
      userId,
      {
        subscriptions: filteredSubs,
        preferences: nextPreferences
      },
      accessToken
    );
  } catch (_) {}

  return true;
}

export async function removeSubscription({ user_id, endpoint, accessToken = null }) {
  if (!endpoint) return false;

  // 1. Remove from local dev file
  try {
    const remaining = getStoredSubscriptions().filter((s) => s.endpoint !== endpoint);
    writeLocalSubscriptions(remaining);
  } catch (_) {}

  // 2. Remove from Supabase push_subscriptions
  const dbClient = createSupabaseServerClient(accessToken);
  if (dbClient && user_id) {
    try {
      await dbClient
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', user_id);
    } catch (_) {}
  }

  // 3. Remove from encrypted vault
  if (user_id) {
    try {
      const existingVault = await readUserVault(user_id, dbClient);
      const filteredSubs = existingVault.subscriptions.filter((s) => s.endpoint !== endpoint);
      await writeUserVault(
        user_id,
        {
          subscriptions: filteredSubs,
          preferences: existingVault.preferences
        },
        accessToken
      );
    } catch (_) {}
  }

  return true;
}

export async function saveUserPreferences({ user_id, preferences, accessToken = null }) {
  if (!user_id || !preferences) return false;
  const dbClient = createSupabaseServerClient(accessToken);
  try {
    const existingVault = await readUserVault(user_id, dbClient);
    const mergedPreferences = {
      ...existingVault.preferences,
      ...preferences
    };
    await writeUserVault(
      user_id,
      {
        subscriptions: existingVault.subscriptions,
        preferences: mergedPreferences
      },
      accessToken
    );
    return mergedPreferences;
  } catch (_) {
    return null;
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

// Deduplicate recent post push deliveries on the server instance
const recentServerDeliveries = new Map();
function isDuplicateDelivery(postId, recipientId) {
  if (!postId || !recipientId) return false;
  const key = `${postId}:${recipientId}`;
  const now = Date.now();
  const prev = recentServerDeliveries.get(key);
  if (prev && now - prev < 60_000) {
    return true;
  }
  recentServerDeliveries.set(key, now);
  if (recentServerDeliveries.size > 500) {
    const firstKey = recentServerDeliveries.keys().next().value;
    recentServerDeliveries.delete(firstKey);
  }
  return false;
}

// Send Web Push notification to recipient user IDs
export async function sendWebPushNotification({
  recipientIds = [],
  ideaId = null,
  postId = null,
  title = 'New message on Ideate',
  body = 'Someone posted in your discussion. Tap to view.',
  authorId = null,
  isMentionMap = {},
  accessToken = null
}) {
  const isConfigured = configureVapid();
  if (!isConfigured) {
    console.warn('[WebPush Server] VAPID keys not configured in environment.');
    return { delivered: 0, reason: 'VAPID keys not configured' };
  }

  // Never send a post notification to the sender themselves (unless explicitly running a self-test without postId)
  const cleanRecipientIds = Array.from(new Set(recipientIds)).filter((uid) => {
    if (!uid) return false;
    if (postId && authorId && uid === authorId) return false;
    if (postId && isDuplicateDelivery(postId, uid)) return false;
    return true;
  });

  if (cleanRecipientIds.length === 0) {
    return { delivered: 0, recipientCount: 0, message: 'No eligible recipients' };
  }

  const serverClient = createSupabaseServerClient(accessToken) || createSupabaseServerClient();
  const adminClient = createSupabaseServerClient();

  // 1. Gather local dev subscriptions
  const localSubs = getStoredSubscriptions().filter((s) => cleanRecipientIds.includes(s.user_id));

  // 2. Query Supabase push_subscriptions table (works if SUPABASE_SECRET_KEY is configured)
  let dbSubs = [];
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from('push_subscriptions')
        .select('*')
        .in('user_id', cleanRecipientIds);
      if (Array.isArray(data)) {
        dbSubs = data;
      }
    } catch (_) {}
  }

  // 3. Read AES-256-GCM encrypted server vaults for each recipient
  const vaultSubs = [];
  const recipientPreferences = new Map();

  await Promise.all(
    cleanRecipientIds.map(async (uid) => {
      const vault = await readUserVault(uid, serverClient);
      recipientPreferences.set(uid, vault.preferences || getDefaultPreferences());
      if (Array.isArray(vault.subscriptions)) {
        vault.subscriptions.forEach((s) => {
          vaultSubs.push({ ...s, user_id: uid });
        });
      }
    })
  );

  // Combine and deduplicate subscriptions by endpoint, filtering by user preferences
  const subMap = new Map();
  [...localSubs, ...dbSubs, ...vaultSubs].forEach((s) => {
    if (!s || !s.endpoint || !s.p256dh || !s.auth || !s.user_id) return;
    const prefs = recipientPreferences.get(s.user_id) || s.preferences || getDefaultPreferences();

    // Respect user notification preferences & muted ideas
    if (postId) {
      if (prefs.push_enabled === false) return;
      if (ideaId && Array.isArray(prefs.muted_ideas) && prefs.muted_ideas.includes(ideaId)) {
        return;
      }
      const isMentioned = Boolean(isMentionMap && isMentionMap[s.user_id]);
      if (isMentioned) {
        if (prefs.mentions === false && prefs.new_messages === false) return;
      } else {
        if (prefs.new_messages === false) return;
      }
    }

    subMap.set(s.endpoint, s);
  });

  const allSubscriptions = Array.from(subMap.values());
  if (allSubscriptions.length === 0) {
    return {
      delivered: 0,
      recipientCount: cleanRecipientIds.length,
      message: 'No active push subscriptions found for eligible recipients'
    };
  }

  let deliveredCount = 0;
  const expiredByUser = new Map();

  await Promise.all(
    allSubscriptions.map(async (sub) => {
      const isMentioned = Boolean(isMentionMap && isMentionMap[sub.user_id]);
      const customTitle = isMentioned && isMentionMap[sub.user_id]?.title
        ? isMentionMap[sub.user_id].title
        : title;

      const payload = JSON.stringify({
        title: customTitle,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: ideaId ? `ideate-idea-${ideaId}` : 'ideate-message',
        ideaId,
        postId,
        url: ideaId ? `/?ideaId=${ideaId}${postId ? `&postId=${postId}` : ''}` : '/',
        data: {
          url: ideaId ? `/?ideaId=${ideaId}${postId ? `&postId=${postId}` : ''}` : '/',
          ideaId,
          postId,
          authorId
        }
      });

      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, payload, {
          TTL: 86400,
          urgency: 'high'
        });
        deliveredCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          const list = expiredByUser.get(sub.user_id) || [];
          list.push(sub.endpoint);
          expiredByUser.set(sub.user_id, list);
        } else {
          console.warn('[WebPush Server] Push delivery error:', err.statusCode || err.message);
        }
      }
    })
  );

  // Clean up expired subscriptions (HTTP 404 / 410)
  if (expiredByUser.size > 0) {
    const allExpiredEndpoints = Array.from(expiredByUser.values()).flat();
    try {
      const remaining = getStoredSubscriptions().filter(
        (s) => !allExpiredEndpoints.includes(s.endpoint)
      );
      writeLocalSubscriptions(remaining);
    } catch (_) {}

    if (adminClient) {
      try {
        await adminClient
          .from('push_subscriptions')
          .delete()
          .in('endpoint', allExpiredEndpoints);
      } catch (_) {}
    }

    for (const [uid, endpoints] of expiredByUser.entries()) {
      try {
        const vault = await readUserVault(uid, serverClient);
        const nextSubs = vault.subscriptions.filter((s) => !endpoints.includes(s.endpoint));
        await writeUserVault(uid, { subscriptions: nextSubs, preferences: vault.preferences }, accessToken);
      } catch (_) {}
    }
  }

  return {
    delivered: deliveredCount,
    totalAttempted: allSubscriptions.length,
    recipientCount: cleanRecipientIds.length,
    expiredCleaned: Array.from(expiredByUser.values()).flat().length
  };
}
