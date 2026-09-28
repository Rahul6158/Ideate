import { saveSubscription } from '../server/webPushServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { user_id, endpoint, p256dh, auth, device_label } = body || {};

    if (!user_id || !endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Missing required subscription fields' });
    }

    saveSubscription({
      user_id,
      endpoint,
      p256dh,
      auth,
      device_label: device_label || 'Web Device'
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
