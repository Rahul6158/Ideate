import { withSupabase } from 'npm:@supabase/server';

const NVIDIA_MODEL = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3-ultra-550b-a55b';
const NVIDIA_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';

const IDVY_SYSTEM_PROMPT = `You are Idvy, a nice, smart, and enthusiastic friend and idea collaborator inside Ideate.
You participate directly inside collaborative idea discussions alongside human team members as their trusted partner in brainstorming, organizing, validating, and building.

Your personality & tone:
- You are a genuine, friendly, and enthusiastic teammate who brings positive energy, sharp intelligence, and supportive warmth to every conversation.
- You celebrate great insights, validate ambitious thinking, and proactively help build ideas into reality.
- Speak with natural camaraderie, warmth, and clarity — NEVER robotic, dry, sterile, or overly corporate.
- ALWAYS address the speaking user by name with a friendly tag (e.g., "@Rahul" or "@Name").
- If the idea currently has no other members, make the user feel confident that having you as their creative partner is more than enough to take this idea from concept to execution!

CRITICAL CONSTRAINTS:
- NEVER say "I am an AI assistant", "As an AI language model", "I'm just a bot", or describe yourself with clinical disclaimers.
- NEVER claim "What I'm not: I don't have external tools (no web search, no file access, no API calls)" — you DO have live web search (/websearch, /research), discussion memory, and idea tools in Ideate!
- If asked "what can you do?" or "who are you?", speak like an excited creative co-founder and friend: greet them by @Name, express your excitement about their idea, and highlight how you can brainstorm together, pressure-test assumptions, keep decisions organized, and research the market.
- Respond quickly, brightly, and concisely to simple questions or greetings, without unnecessary essays unless a deep analysis was requested.

All the features you are designed to help with:
1. Brainstorming & Idea Evolution (/coreidea, /improve): Help founders refine raw thoughts into viable, execution-ready concepts and suggest creative improvements.
2. Rigorous Validation (/validate, /risks): Evaluate suggestions with deep critical thinking — examine strengths, hidden assumptions, potential challenges, smart alternatives, and concrete next steps (without cheesy 1-10 numerical ratings).
3. Discussion Summarization (/summarize, /summarize @member): Keep everyone aligned by summarizing conversation progress and spotlighting individual member contributions.
4. Decision & Action Item Tracking (/decisions, /actionitems, /openquestions): Differentiate confirmed team consensus decisions from informal casual suggestions, spot unresolved questions, and organize clear next steps.
5. Live Web & Market Research (/websearch, /research): Bring in relevant market context, trends, competitor insights, and cite live sources cleanly.
6. Friendly Collaboration (@Idvy): Whenever tagged or asked a question, jump in with helpful, actionable insights as a supportive and smart friend.

Format your responses cleanly with readable Markdown (bullet points, bold highlights, concise sections) so it is delightful to read in chat.`;

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    try {
      const body = await req.json();
      const {
        ideaId,
        userPrompt,
        command = null,
        args = '',
        targetMember = null,
        callerUserId = ctx.userClaims?.sub || (ctx as any).user?.id || null
      } = body;

      if (!ideaId) {
        return Response.json({ error: 'Missing ideaId parameter' }, { status: 400 });
      }

      // Check caller AI permission on idea_ai_access
      if (callerUserId) {
        const { data: accessRecord } = await ctx.supabaseAdmin
          .from('idea_ai_access')
          .select('can_use_ai, is_ai_enabled')
          .eq('idea_id', ideaId)
          .eq('user_id', callerUserId)
          .maybeSingle();

        if (accessRecord) {
          if (!accessRecord.is_ai_enabled) {
            return Response.json({ error: 'Idvy is currently disabled for this idea by the owner.' }, { status: 403 });
          }
          if (!accessRecord.can_use_ai) {
            return Response.json({ error: 'You do not have permission to interact with Idvy in this idea.' }, { status: 403 });
          }
        }
      }

      // Fetch idea details, members, recent posts, and rolling memory in parallel
      const [ideaRes, membersRes, postsRes, memoryRes] = await Promise.all([
        ctx.supabaseAdmin.from('ideas').select('id, title, description, owner_id').eq('id', ideaId).single(),
        ctx.supabaseAdmin.from('idea_members').select('id, user_id, role, profiles(id, display_name, email)').eq('idea_id', ideaId),
        ctx.supabaseAdmin.from('posts').select('id, content, sender_type, agent_name, created_at, user:profiles(display_name, email)').eq('idea_id', ideaId).order('created_at', { ascending: true }).limit(50),
        ctx.supabaseAdmin.from('idea_ai_memory').select('*').eq('idea_id', ideaId).maybeSingle()
      ]);

      const idea = ideaRes.data || { id: ideaId, title: 'Idea Space' };
      const members = (membersRes.data || []).map((m: any) => ({
        id: m.profiles?.id || m.user_id,
        display_name: m.profiles?.display_name,
        email: m.profiles?.email,
        role: m.role
      }));
      const posts = postsRes.data || [];
      const memory = memoryRes.data || null;

      // Check if external web search is needed
      let searchResults: Array<{ title: string; snippet: string; url: string }> = [];
      const isSearchCommand = command === 'websearch' || command === 'research';
      if (isSearchCommand && args) {
        try {
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args)}`;
          const searchRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (searchRes.ok) {
            const html = await searchRes.text();
            const blocks = html.split('<div class="result results_links');
            for (let i = 1; i < blocks.length && searchResults.length < 5; i++) {
              const b = blocks[i];
              const titleM = b.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
              const linkM = b.match(/<a[^>]+class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                            b.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>/i);
              const snipM = b.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
              let url = linkM ? linkM[1] : '';
              if (url.includes('uddg=')) {
                try { url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]); } catch (_) {}
              }
              const title = (titleM ? titleM[1] : 'Source').replace(/<[^>]+>/g, '').trim();
              const snippet = (snipM ? snipM[1] : '').replace(/<[^>]+>/g, '').trim();
              if (url && (title || snippet)) {
                searchResults.push({ title, snippet, url });
              }
            }
          }
        } catch (sErr) {
          console.warn('Edge function web search failed:', sErr);
        }
      }

      // Build context
      const formattedPosts = posts.map((p: any) => {
        const author = p.user?.display_name || p.user?.email || (p.agent_name === 'idvy' ? 'Idvy (AI)' : 'Member');
        return `${author} (${p.created_at || 'Recently'}): ${p.content || '[Attachment]'}`;
      }).join('\n');

      const systemPrompt = `${IDVY_SYSTEM_PROMPT}

=== CURRENT IDEA CONTEXT ===
Title: ${idea.title}
Description: ${idea.description || 'None provided'}
Collaborators: ${members.map((m: any) => `${m.display_name || m.email || 'Member'} (${m.role})`).join(', ')}

=== DISCUSSION TRANSCRIPT ===
${formattedPosts}

${searchResults.length > 0 ? `=== WEB RESEARCH DATA ===\n${searchResults.map((r, i) => `[Source ${i + 1}] ${r.title} - ${r.url}\nExcerpt: ${r.snippet}`).join('\n\n')}\n*Cite these sources in your answer.*` : ''}`;

      const userMessage = command
        ? `[Command: /${command} ${args || ''}] ${targetMember ? `(Target Member: @${targetMember})` : ''} - User prompt: ${userPrompt || ''}`
        : (userPrompt || 'Can you summarize our idea and share your perspective?');

      const nvidiaApiKey = Deno.env.get('NVIDIA_API_KEY');
      if (!nvidiaApiKey) {
        return Response.json({
          content: `I'm Idvy! I've analyzed your idea "${idea.title}" and the discussion with ${members.length} members. To enable live inference with NVIDIA Nemotron 3 Ultra 550B, configure NVIDIA_API_KEY in your Supabase secrets.`,
          agent_name: 'idvy',
          sources: searchResults
        });
      }

      const isStream = Boolean(body?.stream);

      // Call NVIDIA NIM
      const nimResponse = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nvidiaApiKey}`
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 3500,
          stream: isStream
        })
      });

      if (!nimResponse.ok) {
        const errText = await nimResponse.text();
        return Response.json({ error: `NVIDIA NIM Error: ${errText}` }, { status: 502 });
      }

      if (isStream && nimResponse.body) {
        return new Response(nimResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const nimData = await nimResponse.json();
      const generatedContent = nimData.choices?.[0]?.message?.content || 'No response generated.';

      // Async update rolling memory in background
      (async () => {
        try {
          await ctx.supabaseAdmin.from('idea_ai_memory').upsert({
            idea_id: ideaId,
            discussion_summary: generatedContent.slice(0, 500),
            updated_at: new Date().toISOString()
          });
        } catch (_) {}
      })();

      return Response.json({
        content: generatedContent,
        agent_name: 'idvy',
        sources: searchResults
      });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  })
};
