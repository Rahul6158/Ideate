import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await req.json();
      const { endpoint } = body;

      if (!endpoint) {
        return new Response(
          JSON.stringify({ error: 'Missing subscription endpoint' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Delete only the subscription matching the authenticated user
      const { error } = await ctx.supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', ctx.user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
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
