import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    try {
      const userId = ctx.userClaims?.sub || (ctx as any).user?.id;
      if (!userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const body = await req.json();
      const { endpoint, p256dh, auth, device_name, device_label } = body;

      if (!endpoint || !p256dh || !auth) {
        return Response.json(
          { error: 'Missing required subscription fields' },
          { status: 400 }
        );
      }

      const label = device_name || device_label || 'Web Device';

      const { data, error } = await ctx.supabaseAdmin
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            device_label: label,
            last_used_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        )
        .select()
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true, data });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400 });
    }
  })
};
