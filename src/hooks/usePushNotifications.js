import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService } from '../services/pushNotifications';
import { useAuth } from '../context/AuthContext';

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deviceLabel, setDeviceLabel] = useState('');

  const checkStatus = useCallback(async () => {
    const supported = pushNotificationService.isPushSupported();
    setIsSupported(supported);
    setDeviceLabel(pushNotificationService.getDeviceLabel());

    if (!supported) {
      setLoading(false);
      return;
    }

    setPermission(pushNotificationService.getPermissionState());

    try {
      // Ensure SW is registered
      await pushNotificationService.registerServiceWorker();
      const sub = await pushNotificationService.getSubscription();
      setIsSubscribed(Boolean(sub));
      if (sub && currentUser?.id) {
        pushNotificationService.syncSubscription(currentUser.id).catch(() => {});
      }
    } catch (err) {
      console.warn('[usePushNotifications] Error checking status:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus, currentUser?.id]);

  const subscribe = async () => {
    if (!currentUser?.id) {
      throw new Error('Please sign in to enable notifications.');
    }

    setLoading(true);
    setError(null);

    try {
      await pushNotificationService.subscribeUser(currentUser.id);
      setIsSubscribed(true);
      setPermission(Notification.permission);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to enable notifications');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      await pushNotificationService.unsubscribeUser(currentUser?.id);
      setIsSubscribed(false);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to disable notifications');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setError(null);
    try {
      await pushNotificationService.sendTestNotification(currentUser?.id);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to send test notification');
      throw err;
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    deviceLabel,
    subscribe,
    unsubscribe,
    sendTest,
    refreshStatus: checkStatus
  };
}
