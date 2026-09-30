import { removeSubscription } from '../server/webPushServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { user_id, endpoint } = body || {};

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint' });
    }

    await removeSubscription({
      user_id,
      endpoint,
      accessToken
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
