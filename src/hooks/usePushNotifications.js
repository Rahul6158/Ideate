import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService } from '../services/pushNotifications';
import { useAuth } from '../context/AuthContext';

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [platformDiagnostics, setPlatformDiagnostics] = useState({
    isIOS: false,
    isAndroid: false,
    isStandalone: false,
    requiresHomeScreen: false
  });
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState(null);
  const [devices, setDevices] = useState([]);
  const [preferences, setPreferences] = useState({
    push_enabled: true,
    new_messages: true,
    mentions: true,
    muted_ideas: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deviceLabel, setDeviceLabel] = useState('');

  const checkStatus = useCallback(async () => {
    const diag = pushNotificationService.getPlatformDiagnostics();
    setPlatformDiagnostics(diag);

    const supported = pushNotificationService.isPushSupported();
    setIsSupported(supported);
    setDeviceLabel(pushNotificationService.getDeviceLabel());

    if (currentUser?.id) {
      setPreferences(pushNotificationService.getPreferences(currentUser.id));
    }

    if (!supported) {
      if (currentUser?.id) {
        const userDevs = await pushNotificationService.getUserDevices(currentUser.id);
        setDevices(userDevs);
      }
      setLoading(false);
      return;
    }

    const perm = pushNotificationService.getPermissionState();
    setPermission(perm);

    try {
      await pushNotificationService.registerServiceWorker();
      const sub = await pushNotificationService.getSubscription();
      const activeSub = Boolean(sub && perm === 'granted');
      setIsSubscribed(activeSub);
      setCurrentEndpoint(sub?.endpoint || null);

      if (activeSub && currentUser?.id) {
        await pushNotificationService.syncSubscription(currentUser.id);
      }

      if (currentUser?.id) {
        const userDevs = await pushNotificationService.getUserDevices(currentUser.id);
        setDevices(userDevs);
      }
    } catch (err) {
      console.warn('[usePushNotifications] Error checking status:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for Service Worker pushsubscriptionchange events
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !currentUser?.id) {
      return;
    }
    const handleSwMessage = (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        pushNotificationService.syncSubscription(currentUser.id).then(() => {
          checkStatus();
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [currentUser?.id, checkStatus]);

  const subscribe = async () => {
    if (!currentUser?.id) {
      throw new Error('Please sign in to enable notifications.');
    }

    setLoading(true);
    setError(null);

    try {
      const sub = await pushNotificationService.subscribeUser(currentUser.id);
      setIsSubscribed(true);
      setCurrentEndpoint(sub?.endpoint || null);
      setPermission(Notification.permission);
      setPreferences(pushNotificationService.getPreferences(currentUser.id));
      const userDevs = await pushNotificationService.getUserDevices(currentUser.id);
      setDevices(userDevs);
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
      setCurrentEndpoint(null);
      if (currentUser?.id) {
        const userDevs = await pushNotificationService.getUserDevices(currentUser.id);
        setDevices(userDevs);
      }
      return true;
    } catch (err) {
      setError(err.message || 'Failed to disable notifications');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (endpoint) => {
    if (!currentUser?.id || !endpoint) return false;
    setError(null);
    try {
      await pushNotificationService.removeDevice(currentUser.id, endpoint);
      if (endpoint === currentEndpoint) {
        setIsSubscribed(false);
        setCurrentEndpoint(null);
      }
      const userDevs = await pushNotificationService.getUserDevices(currentUser.id);
      setDevices(userDevs);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to remove device');
      throw err;
    }
  };

  const updatePreferences = async (partialPrefs) => {
    if (!currentUser?.id) return null;
    const updated = await pushNotificationService.updatePreferences(currentUser.id, partialPrefs);
    setPreferences(updated);
    return updated;
  };

  const toggleMuteIdea = async (ideaId) => {
    if (!currentUser?.id || !ideaId) return null;
    const updated = await pushNotificationService.toggleMuteIdea(currentUser.id, ideaId);
    setPreferences(updated);
    return updated;
  };

  const sendTest = async (options = {}) => {
    setError(null);
    try {
      await pushNotificationService.sendTestNotification(currentUser?.id, options);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to send test notification');
      throw err;
    }
  };

  return {
    isSupported,
    platformDiagnostics,
    permission,
    isSubscribed,
    currentEndpoint,
    devices,
    preferences,
    loading,
    error,
    deviceLabel,
    subscribe,
    unsubscribe,
    removeDevice,
    updatePreferences,
    toggleMuteIdea,
    sendTest,
    refreshStatus: checkStatus
  };
}
