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
   * Show a real native browser notification if granted
   */
  showDesktopNotification(title, message, icon = '/logo.png') {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: message,
          icon,
          badge: '/logo.png',
          vibrate: [200, 100, 200]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
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
   * Synchronous getter from cache / local storage
   */
  getNotifications() {
    if (this._cachedNotifications && this._cachedNotifications.length > 0) {
      return this._cachedNotifications;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (stored) {
        this._cachedNotifications = JSON.parse(stored);
        return this._cachedNotifications;
      }
    } catch (_) {}
    return [];
  },

  getUnreadCount() {
    const list = this.getNotifications();
    return list.filter(n => !n.is_read).length;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id) {
    this._cachedNotifications = this._cachedNotifications.map(n => 
      n.id === id ? { ...n, is_read: true } : n
    );
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    } catch (_) {}

    return this._cachedNotifications;
  },

  /**
   * Toggle read status of a notification
   */
  async toggleReadStatus(id) {
    const current = Array.isArray(this._cachedNotifications) && this._cachedNotifications.length > 0
      ? this._cachedNotifications
      : this.getNotifications();
    let target = null;
    this._cachedNotifications = current.map(n => {
      if (n.id === id) {
        target = { ...n, is_read: !n.is_read };
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
          .update({ is_read: target.is_read })
          .eq('id', id);
      } catch (_) {}
    }

    return this._cachedNotifications;
  },

  /**
   * Mark all as read
   */
  async markAllAsRead(userId) {
    const current = Array.isArray(this._cachedNotifications) && this._cachedNotifications.length > 0
      ? this._cachedNotifications
      : this.getNotifications();
    this._cachedNotifications = current.map(n => ({ ...n, is_read: true }));
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this._cachedNotifications));
    this._notifyListeners();

    if (userId) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
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
            this.showDesktopNotification(notif.title, notif.message);
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
