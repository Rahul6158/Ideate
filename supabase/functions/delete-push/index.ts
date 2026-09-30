import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    try {
      const userId = ctx.userClaims?.sub || (ctx as any).user?.id;
      if (!userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const body = await req.json();
      const { endpoint, id } = body;

      if (!endpoint && !id) {
        return Response.json(
          { error: 'Missing subscription endpoint or id' },
          { status: 400 }
        );
      }

      let query = ctx.supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('endpoint', endpoint);
      }

      const { error } = await query;

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400 });
    }
  })
};
