import { withSupabase } from 'npm:@supabase/server';
import webpush from 'npm:web-push';

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    try {
      const body = await req.json();
      const record = body.record || body;
      const postId = record.id || record.post_id || record.postId || null;
      const ideaId = record.idea_id || record.ideaId || null;
      const callerUserId = ctx.userClaims?.sub || (ctx as any).user?.id || null;
      const authorId = record.user_id || record.authorId || callerUserId;
      const content = record.content || record.body || '';

      if (!ideaId || !authorId) {
        return Response.json(
          { error: 'Missing idea_id or author user_id in payload' },
          { status: 400 }
        );
      }

      // If invoked by an authenticated user, verify caller matches authorId
      if (ctx.authMode === 'user' && callerUserId && authorId !== callerUserId) {
        return Response.json(
          { error: 'Forbidden: authorId does not match authenticated caller' },
          { status: 403 }
        );
      }

      // Configure VAPID credentials from Supabase Edge Function secrets
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ideate.app';

      if (!vapidPublicKey || !vapidPrivateKey) {
        return Response.json(
          {
            success: false,
            pushDelivered: 0,
            error: 'VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not configured in Supabase secrets'
          },
          { status: 500 }
        );
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      // Fetch idea & author metadata using admin client
      const [ideaRes, authorRes, membersRes] = await Promise.all([
        ctx.supabaseAdmin
          .from('ideas')
          .select('id, title, owner_id')
          .eq('id', ideaId)
          .single(),
        ctx.supabaseAdmin
          .from('profiles')
          .select('id, display_name, email')
          .eq('id', authorId)
          .single(),
        ctx.supabaseAdmin
          .from('idea_members')
          .select('user_id, role')
          .eq('idea_id', ideaId)
          .neq('role', 'pending_invite')
          .neq('role', 'pending_join')
      ]);

      const idea = ideaRes.data;
      if (!idea) {
        return Response.json({ error: 'Idea not found' }, { status: 404 });
      }

      // Verify author is the owner or an active member of this idea
      const activeMemberIds = new Set<string>();
      if (idea.owner_id) activeMemberIds.add(idea.owner_id);
      if (Array.isArray(membersRes.data)) {
        membersRes.data.forEach((m: { user_id: string }) => {
          if (m.user_id) activeMemberIds.add(m.user_id);
        });
      }

      if (!activeMemberIds.has(authorId)) {
        return Response.json(
          { error: 'Forbidden: sender is not a member of this idea' },
          { status: 403 }
        );
      }

      // Determine recipients: all idea members + owner, excluding the sender
      activeMemberIds.delete(authorId);
      const recipientIds = Array.from(activeMemberIds);

      if (recipientIds.length === 0) {
        return Response.json({
          success: true,
          recipients: 0,
          pushDelivered: 0,
          message: 'No other members to notify'
        });
      }

      const author = authorRes.data;
      const ideaTitle = idea.title || 'Idea Discussion';
      const authorName = author?.display_name || author?.email?.split('@')[0] || 'Someone';
      const notificationTitle = record.title || `${authorName} in ${ideaTitle}`;
      const notificationBody = content
        ? (content.length > 140 ? content.substring(0, 137) + '...' : content)
        : 'Posted a new message in your idea discussion.';

      // Fetch active push subscriptions for recipients using admin client (bypasses per-user RLS)
      const { data: subscriptions, error: subError } = await ctx.supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', recipientIds);

      if (subError || !subscriptions || subscriptions.length === 0) {
        return Response.json({
          success: true,
          recipients: recipientIds.length,
          pushDelivered: 0
        });
      }

      const pushPayload = JSON.stringify({
        title: notificationTitle,
        body: notificationBody,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `ideate-idea-${ideaId}`,
        ideaId,
        postId,
        url: `/?ideaId=${ideaId}${postId ? `&postId=${postId}` : ''}`,
        data: {
          url: `/?ideaId=${ideaId}${postId ? `&postId=${postId}` : ''}`,
          ideaId,
          postId
        }
      });

      let deliveredCount = 0;
      const deliveredEndpoints: string[] = [];
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
            await webpush.sendNotification(pushSubscription, pushPayload, {
              TTL: 86400,
              urgency: 'high'
            });
            deliveredCount++;
            deliveredEndpoints.push(sub.endpoint);
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            } else {
              console.warn('[send-push-notification] Push error:', err.statusCode || err.message);
            }
          }
        })
      );

      // Update last_used_at for successful deliveries
      if (deliveredEndpoints.length > 0) {
        await ctx.supabaseAdmin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .in('endpoint', deliveredEndpoints);
      }

      // Remove expired subscriptions (HTTP 404 or 410)
      if (expiredEndpoints.length > 0) {
        await ctx.supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredEndpoints);
      }

      return Response.json({
        success: true,
        recipients: recipientIds.length,
        pushDelivered: deliveredCount,
        expiredCleaned: expiredEndpoints.length
      });
    } catch (err: any) {
      return Response.json(
        { error: err.message || 'Internal error sending push notification' },
        { status: 500 }
      );
    }
  })
};
