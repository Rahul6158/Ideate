import { saveSubscription, saveUserPreferences } from '../server/webPushServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      user_id,
      endpoint,
      p256dh,
      auth,
      device_name,
      device_label,
      preferences
    } = body || {};

    // Allow preference-only update if endpoint is omitted
    if (user_id && preferences && !endpoint) {
      const savedPrefs = await saveUserPreferences({
        user_id,
        preferences,
        accessToken
      });
      return res.status(200).json({ success: true, preferences: savedPrefs });
    }

    if (!user_id || !endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Missing required subscription fields' });
    }

    await saveSubscription(
      {
        user_id,
        endpoint,
        p256dh,
        auth,
        device_name: device_name || device_label || 'Web Device',
        device_label: device_label || device_name || 'Web Device',
        preferences
      },
      accessToken
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
