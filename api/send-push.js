import { sendWebPushNotification } from '../server/webPushServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      recipientIds,
      ideaId,
      postId,
      title,
      body: messageBody,
      authorId,
      isMentionMap
    } = body || {};

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: 'No recipientIds provided' });
    }

    const result = await sendWebPushNotification({
      recipientIds,
      ideaId,
      postId,
      title: title || 'New message on Ideate',
      body: messageBody || 'Someone posted in your discussion. Tap to view.',
      authorId,
      isMentionMap: isMentionMap || {},
      accessToken
    });

    return res.status(200).json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
