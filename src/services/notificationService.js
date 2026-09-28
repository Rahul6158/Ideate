import { playNotificationSound } from '../utils/soundEffects';
import { supabase } from '../lib/supabase';

const STORAGE_KEY_NOTIFICATIONS = 'ideate_notifications_v1';

let activeRealtimeChannel = null;
let currentSubscribedUserId = null;

export const notificationService = {
  // Local cache
  _cachedNotifications: [],
  _unreadCounts: {}, // { [ideaId]: number }

  /**
   * Request native browser notification permissions
   */
  async requestBrowserPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const res = await Notification.requestPermission();
          return res === 'granted';
        } catch (_) {
          return false;
        }
      }
      return Notification.permission === 'granted';
    }
    return false;
  },

  /**
   * Show a real native notification (uses Service Worker on mobile & desktop, with desktop Notification fallback)
   */
  async showDesktopNotification(title, message, icon = '/icons/notification-icon.png', data = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      // 1. Mobile browsers (Android Chrome, iOS PWA) strictly require ServiceWorker showNotification
      if ('serviceWorker' in navigator) {
        try {
          let reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 2000))
          ]).catch(() => null);

          if (!reg) {
            reg = await navigator.serviceWorker.getRegistration();
          }

          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body: message,
              icon,
              badge: '/icons/notification-badge.png',
              vibrate: [200, 100, 200],
              data: {
                url: data?.url || (data?.ideaId ? `/?ideaId=${data.ideaId}` : '/'),
                ...data
              },
              tag: data?.ideaId ? `idea-${data.ideaId}` : 'ideate-alert',
              renotify: true
            });
            return;
          }
        } catch (swErr) {
          console.warn('[SW showNotification error, trying fallback]:', swErr);
        }
      }

      // 2. Desktop-only fallback
      const notif = new Notification(title, {
        body: message,
        icon,
        badge: '/icons/notification-badge.png',
        vibrate: [200, 100, 200]
      });
      notif.onclick = () => {
        window.focus();
        if (data?.url) {
          window.location.href = data.url;
        }
        notif.close();
      };
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
  },

  /**
   * Fetch all notifications for the user from Supabase with fallback to localStorage
   */
  async fetchNotifications(userId) {
    if (!userId) {
      return this.getNotifications();
    }

    try {
      // First auto-clear notifications viewed over an hour ago
      await this.purgeExpiredViewedNotifications(userId);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data) {
        this._cachedNotifications = data;
        localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(data));
        this._notifyListeners();
        return data;
      }
    } catch (err) {
      console.warn('Failed to fetch notifications from Supabase:', err);
    }

    return this.getNotifications();
  },

  /**
   * Synchronous getter from cache / local storage with auto-expiration for viewed notifications
   */
  getNotifications() {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();

    let list = [];
    if (this._cachedNotifications && this._cachedNotifications.length > 0) {
      list = this._cachedNotifications;
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
        if (stored) {
          list = JSON.parse(stored);
          this._cachedNotifications = list;
        }
      } catch (_) {}
    }

    // Auto-clear notifications viewed for more than an hour
    const valid = (list || []).filter(n => {
      if (n.is_read) {
        const viewedAtTime = n.viewed_at 
          ? new Date(n.viewed_at).getTime() 
          : (n.created_at ? new Date(n.created_at).getTime() : now);
        if (now - viewedAtTime >= ONE_HOUR_MS) {
          return false;
        }
      }
      return true;
    });

    if (valid.length !== (list || []).length) {
      this._cachedNotifications = valid;
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(valid));
    }

    return valid;
  },

  getUnreadCount() {
    const list = this.getNotifications();
    return list.filter(n => !n.is_read).length;
  },

  /**
   * Auto-clear notifications that have been marked as viewed/read for over 1 hour
   */
  async purgeExpiredViewedNotifications(userId) {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const current = this.getNotifications();
    const expiredIds = [];

    const remaining = current.filter(n => {
      if (n.is_read) {
        const viewedTimestamp = n.viewed_at 
          ? new Date(n.viewed_at).getTime() 
          : (n.created_at ? new Date(n.created_at).getTime() : now);
        if (now - viewedTimestamp >= ONE_HOUR_MS) {
          expiredIds.push(n.id);
          return false;
        }
      }
      return true;
    });

    if (expiredIds.length > 0) {
      this._cachedNotifications = remaining;
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(remaining));
      this._notifyListeners();
    }

    try {
      if (userId) {
        const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('is_read', true)
          .lte('viewed_at', oneHourAgo);
      }
    } catch (err) {
      console.warn('Purge viewed notifications notice:', err);
    }
  },

  /**
   * Mark a single notification as read/viewed
   */
  async markAsRead(id) {
    const nowIso = new Date().toISOString();
    this._cachedNotifications = this._cachedNotifications.map(n => 
      n.id === id ? { ...n, is_read: true, viewed_at: n.viewed_at || nowIso } : n
    );
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, viewed_at: nowIso })
        .eq('id', id);
    } catch (_) {}

    return this._cachedNotifications;
  },

  /**
   * Toggle read status of a notification
   */
  async toggleReadStatus(id) {
    const nowIso = new Date().toISOString();
    const current = Array.isArray(this._cachedNotifications) && this._cachedNotifications.length > 0
      ? this._cachedNotifications
      : this.getNotifications();
    let target = null;
    this._cachedNotifications = current.map(n => {
      if (n.id === id) {
        const newRead = !n.is_read;
        target = { ...n, is_read: newRead, viewed_at: newRead ? (n.viewed_at || nowIso) : null };
        return target;
      }
      return n;
    });
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    if (target && target.id && !String(target.id).startsWith('notif-sample')) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: target.is_read, viewed_at: target.viewed_at })
          .eq('id', id);
      } catch (_) {}
    }

    return this._cachedNotifications;
  },

  /**
   * Mark all as read/viewed
   */
  async markAllAsRead(userId) {
    const nowIso = new Date().toISOString();
    const current = Array.isArray(this._cachedNotifications) && this._cachedNotifications.length > 0
      ? this._cachedNotifications
      : this.getNotifications();
    this._cachedNotifications = current.map(n => ({ 
      ...n, 
      is_read: true, 
      viewed_at: n.viewed_at || nowIso 
    }));
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    if (userId) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true, viewed_at: nowIso })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (_) {}
    }

    return this._cachedNotifications;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id) {
    this._cachedNotifications = this._cachedNotifications.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (_) {}

    return this._cachedNotifications;
  },

  /**
   * Clear all
   */
  async clearAll(userId) {
    this._cachedNotifications = [];
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify([]));
    this._notifyListeners();

    if (userId) {
      try {
        await supabase.from('notifications').delete().eq('user_id', userId);
      } catch (_) {}
    }

    return [];
  },

  /**
   * Add a notification manually
   */
  async addNotification({ title, message, type = 'system', link = null, ideaId = null, playSound = true, userId = null }) {
    const newNotif = {
      id: 'notif-' + Date.now(),
      title,
      message,
      type,
      idea_id: ideaId,
      user_id: userId,
      is_read: false,
      created_at: new Date().toISOString()
    };

    this._cachedNotifications = [newNotif, ...this._cachedNotifications];
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    if (playSound) {
      playNotificationSound();
    }

    this.showDesktopNotification(title, message);

    if (userId) {
      try {
        await supabase.from('notifications').insert([{
          user_id: userId,
          idea_id: ideaId,
          title,
          message,
          type
        }]);
      } catch (_) {}
    }

    return newNotif;
  },

  /**
   * Unread counts per idea in the sidebar
   */
  async fetchUnreadCounts(userId) {
    if (!userId) return {};
    try {
      const { data, error } = await supabase.rpc('get_user_unread_counts', { target_user_id: userId });
      if (!error && Array.isArray(data)) {
        const counts = {};
        data.forEach(item => {
          counts[item.idea_id] = Number(item.unread_count || 0);
        });
        this._unreadCounts = counts;
        this._notifyListeners();
        return counts;
      }
    } catch (err) {
      console.warn('Failed to fetch unread counts:', err);
    }
    return this._unreadCounts;
  },

  getUnreadCounts() {
    return this._unreadCounts;
  },

  /**
   * Mark an idea as read (resets unread badge in sidebar to 0)
   */
  async markIdeaAsRead(userId, ideaId) {
    if (!userId || !ideaId) return;
    this._unreadCounts = {
      ...this._unreadCounts,
      [ideaId]: 0
    };
    this._notifyListeners();

    try {
      await supabase.rpc('mark_idea_as_read', {
        target_user_id: userId,
        target_idea_id: ideaId
      });
    } catch (err) {
      console.warn('mark_idea_as_read error:', err);
    }
  },

  /**
   * Subscribe to real-time notification events for a user
   */
  initRealtimeSubscription(userId) {
    if (!userId || currentSubscribedUserId === userId) return;

    if (activeRealtimeChannel) {
      supabase.removeChannel(activeRealtimeChannel);
    }

    currentSubscribedUserId = userId;
    this.requestBrowserPermission();
    this.fetchNotifications(userId);
    this.fetchUnreadCounts(userId);

    activeRealtimeChannel = supabase
      .channel(`user_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notif = payload.new;
          if (notif) {
            this._cachedNotifications = [notif, ...this._cachedNotifications.filter(n => n.id !== notif.id)];
            localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
            playNotificationSound();
            this.showDesktopNotification(
              notif.title,
              notif.message || notif.body,
              '/icons/notification-icon.png',
              {
                ideaId: notif.idea_id,
                postId: notif.post_id,
                url: notif.idea_id ? `/?ideaId=${notif.idea_id}` : '/'
              }
            );
            this.fetchUnreadCounts(userId);
            this._notifyListeners();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          // New post inserted: re-fetch unread counts so the sidebar immediately displays the badge!
          const post = payload.new;
          if (post && post.user_id !== userId) {
            this.fetchUnreadCounts(userId);
          }
        }
      )
      .subscribe();
  },

  /**
   * Dispatch notification when a new post is published in an idea discussion
   */
  async notifyPostCreated({ post, ideaId, authorUser }) {
    if (!ideaId || !authorUser?.id) return;

    try {
      const { data: idea } = await supabase
        .from('ideas')
        .select('id, title, owner_id')
        .eq('id', ideaId)
        .single();

      const ideaTitle = idea?.title || 'Idea Discussion';
      const authorName = authorUser.display_name || authorUser.email?.split('@')[0] || 'Someone';
      const contentSnippet = post.content
        ? (post.content.length > 120 ? post.content.substring(0, 117) + '...' : post.content)
        : 'Shared a new update in discussion.';

      // Find authorized members (excluding the author)
      const { data: members } = await supabase
        .from('idea_members')
        .select('user_id')
        .eq('idea_id', ideaId)
        .neq('user_id', authorUser.id)
        .neq('role', 'pending_invite');

      const recipientSet = new Set();
      if (idea?.owner_id && idea.owner_id !== authorUser.id) {
        recipientSet.add(idea.owner_id);
      }
      if (members) {
        members.forEach(m => recipientSet.add(m.user_id));
      }

      // Also include any users who participated in this discussion thread
      try {
        const { data: threadPosts } = await supabase
          .from('posts')
          .select('user_id')
          .eq('idea_id', ideaId)
          .neq('user_id', authorUser.id);
        if (Array.isArray(threadPosts)) {
          threadPosts.forEach(p => {
            if (p.user_id) recipientSet.add(p.user_id);
          });
        }
      } catch (_) {}

      const recipientIds = Array.from(recipientSet);
      if (recipientIds.length === 0) return;

      const notifications = recipientIds.map(uid => ({
        user_id: uid,
        actor_id: authorUser.id,
        idea_id: ideaId,
        post_id: post.id,
        type: 'new_post',
        title: `${authorName} posted in "${ideaTitle}"`,
        message: contentSnippet,
        body: contentSnippet,
        is_read: false
      }));

      await supabase.from('notifications').insert(notifications);

      // 1. Dispatch Web Push notification via local / Vercel API endpoint
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientIds,
            ideaId,
            postId: post.id,
            title: `${authorName} posted in "${ideaTitle}"`,
            body: contentSnippet,
            authorId: authorUser.id
          })
        });
      } catch (pushErr) {
        console.warn('[Push Service] Delivery via /api/send-push failed:', pushErr.message);
      }

      // 2. Also invoke Edge Function send-push if available
      try {
        await supabase.functions.invoke('send-push', {
          body: { record: { ...post, idea_id: ideaId, user_id: authorUser.id } }
        });
      } catch (_) {}
    } catch (err) {
      console.warn('Failed to dispatch post notifications:', err);
    }
  },

  _notifyListeners() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ideate_notification_update'));
    }
  },

  subscribe(callback) {
    if (typeof window === 'undefined') return () => {};
    const handler = () => callback({
      notifications: this.getNotifications(),
      unreadCount: this.getUnreadCount(),
      unreadCounts: this.getUnreadCounts()
    });
    window.addEventListener('ideate_notification_update', handler);
    return () => window.removeEventListener('ideate_notification_update', handler);
  }
};

// Periodically auto-clear notifications that have been marked as viewed for over 1 hour
if (typeof window !== 'undefined') {
  setInterval(() => {
    notificationService.purgeExpiredViewedNotifications(currentSubscribedUserId);
  }, 60 * 1000);
}
