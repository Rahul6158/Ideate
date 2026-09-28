import { withSupabase } from 'npm:@supabase/server';
import webpush from 'npm:web-push';

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // 1. Verify Webhook Secret if configured
      const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
      if (expectedSecret) {
        const receivedSecret =
          req.headers.get('x-webhook-secret') ||
          req.headers.get('authorization')?.replace('Bearer ', '');
        if (receivedSecret !== expectedSecret) {
          return new Response(JSON.stringify({ error: 'Unauthorized webhook' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 2. Parse payload (supports Supabase Database Webhook format and direct calls)
      const body = await req.json();
      const record = body.record || body;
      const postId = record.id || record.post_id;
      const ideaId = record.idea_id;
      const authorId = record.user_id;
      const content = record.content || '';

      if (!ideaId || !authorId) {
        return new Response(
          JSON.stringify({ error: 'Missing idea_id or user_id in record' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Configure VAPID
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ideate.app';

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      }

      // 4. Fetch Idea & Author details
      const [ideaRes, authorRes] = await Promise.all([
        ctx.supabase
          .from('ideas')
          .select('id, title, owner_id')
          .eq('id', ideaId)
          .single(),
        ctx.supabase
          .from('profiles')
          .select('id, display_name, email')
          .eq('id', authorId)
          .single()
      ]);

      const idea = ideaRes.data;
      const author = authorRes.data;
      const ideaTitle = idea?.title || 'Idea Discussion';
      const authorName = author?.display_name || author?.email?.split('@')[0] || 'Someone';

      // 5. Determine Authorized Recipients (Owner + Members, excluding Author)
      const [membersRes, ownerRes] = await Promise.all([
        ctx.supabase
          .from('idea_members')
          .select('user_id')
          .eq('idea_id', ideaId)
          .neq('user_id', authorId)
          .neq('role', 'pending_invite'),
        ctx.supabase
          .from('ideas')
          .select('owner_id')
          .eq('id', ideaId)
          .neq('owner_id', authorId)
      ]);

      const recipientSet = new Set();
      if (ownerRes.data && ownerRes.data.length > 0 && ownerRes.data[0].owner_id) {
        recipientSet.add(ownerRes.data[0].owner_id);
      }
      if (membersRes.data) {
        membersRes.data.forEach((m: { user_id: string }) => recipientSet.add(m.user_id));
      }

      const recipientIds = Array.from(recipientSet);
      if (recipientIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No other recipients for this post' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 6. Insert in-app notifications records
      const notificationTitle = `${authorName} posted in "${ideaTitle}"`;
      const notificationBody = content
        ? (content.length > 120 ? content.substring(0, 117) + '...' : content)
        : 'New message posted in discussion. Tap to view.';

      const notificationsToInsert = recipientIds.map((userId) => ({
        user_id: userId,
        actor_id: authorId,
        idea_id: ideaId,
        post_id: postId,
        type: 'new_post',
        title: notificationTitle,
        message: notificationBody,
        body: notificationBody,
        is_read: false
      }));

      await ctx.supabase.from('notifications').insert(notificationsToInsert);

      // 7. If VAPID is not configured, we're done with in-app notifications
      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(
          JSON.stringify({
            success: true,
            inAppDelivered: recipientIds.length,
            pushDelivered: 0,
            notice: 'VAPID keys not configured in Edge Function secrets'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 8. Query active push subscriptions for all recipients
      const { data: subscriptions, error: subError } = await ctx.supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', recipientIds);

      if (subError || !subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            inAppDelivered: recipientIds.length,
            pushDelivered: 0
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 9. Deliver Web Push payloads
      const pushPayload = JSON.stringify({
        title: notificationTitle,
        body: notificationBody,
        icon: '/icons/notification-icon.png',
        badge: '/icons/notification-badge.png',
        tag: `idea-${ideaId}`,
        data: {
          url: `/?ideaId=${ideaId}`,
          ideaId,
          postId
        }
      });

      let deliveredCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.all(
        subscriptions.map(async (sub: any) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, pushPayload);
            deliveredCount++;
          } catch (err: any) {
            // If subscription has expired or is unsubscribed (HTTP 404 or 410)
            if (err.statusCode === 404 || err.statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            } else {
              console.warn('[Push] Error sending push to device:', err.message);
            }
          }
        })
      );

      // 10. Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        await ctx.supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredEndpoints);
      }

      return new Response(
        JSON.stringify({
          success: true,
          recipients: recipientIds.length,
          pushDelivered: deliveredCount,
          expiredCleaned: expiredEndpoints.length
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
};
