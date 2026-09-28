import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await req.json();
      const { endpoint, p256dh, auth, device_label } = body;

      if (!endpoint || !p256dh || !auth) {
        return new Response(
          JSON.stringify({ error: 'Missing required subscription fields' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Upsert subscription for the authenticated user
      const { data, error } = await ctx.supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: ctx.user.id,
            endpoint,
            p256dh,
            auth,
            device_label: device_label || 'Web Device',
            last_used_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        )
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
};
