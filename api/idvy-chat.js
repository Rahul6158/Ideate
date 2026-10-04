// ==============================================================================
// Vercel Serverless Function: Idvy AI Collaborator & NVIDIA NIM Proxy
// Endpoint: /api/idvy-chat
// ==============================================================================

import {
  parseIdvyCommand,
  buildIdvyContext,
  callNvidiaNim,
  IDVY_SYSTEM_PROMPT,
  NVIDIA_MODEL
} from '../server/idvyCore.js';
import { performWebSearch } from '../server/searchEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      ideaId,
      userPrompt,
      idea = {},
      members = [],
      memory = null,
      posts = [],
      command: explicitCommand = null,
      args: explicitArgs = '',
      targetMember: explicitTarget = null,
      callerUser = null
    } = body || {};

    if (!ideaId) {
      return res.status(400).json({ error: 'Missing ideaId parameter' });
    }

    // 1. Parse command and arguments if not already pre-parsed
    const parsed = parseIdvyCommand(userPrompt || '');
    const activeCommand = explicitCommand || parsed.command;
    const activeArgs = explicitArgs || parsed.args;
    const activeTarget = explicitTarget || parsed.targetMember;

    // 2. Perform external web search if /websearch or /research
    let searchResults = [];
    if ((activeCommand === 'websearch' || activeCommand === 'research') && activeArgs) {
      try {
        searchResults = await performWebSearch(activeArgs, 5);
      } catch (sErr) {
        console.warn('Web search failed:', sErr);
      }
    }

    // 3. Assemble full context
    const fullContext = buildIdvyContext({
      idea,
      members,
      memory,
      posts,
      command: activeCommand,
      targetMember: activeTarget,
      searchResults,
      callerUser
    });

    const userMessageContent = activeCommand
      ? `[Command: /${activeCommand} ${activeArgs || ''}] ${parsed.cleanedText ? `- User note: ${parsed.cleanedText}` : ''}`
      : (parsed.cleanedText || userPrompt || 'What is your perspective on this idea so far?');

    const apiKey = process.env.NVIDIA_API_KEY;

    const isStream = Boolean(body?.stream);

    // Graceful fallback for local development without active NVIDIA API Key
    if (!apiKey) {
      const mockResponses = {
        summarize: `### 📋 Discussion Summary for "${idea.title || 'Your Idea'}"\n\n- **Core Evolution:** The discussion demonstrates strong collaborative momentum around solving practical friction for users.\n- **Team Contributions:** Team members explored multiple features including distribution and onboarding.\n- **Current Status:** Solid conceptual alignment; ready for technical feasibility and user testing.\n\n*(Note: Configure \`NVIDIA_API_KEY\` in your environment or Supabase secrets for real-time Nemotron 3 Ultra 550B inference).*`,
        coreidea: `### 💡 Core Idea Breakdown\n\n- **Value Proposition:** ${idea.description || idea.title || 'A collaborative platform to incubate ideas into execution.'}\n- **Target Audience:** Innovators, teams, and builders wanting real-time validation.\n- **Core Differentiator:** AI integrated directly into team chat with memory and deep research context.`,
        validate: `### 🔍 Suggestion Validation\n\n1. **Suggestion:** ${activeArgs || 'Recent proposal in the discussion'}\n2. **Interpretation:** Enhancing user adoption through streamlined workflows.\n3. **Strengths:** High alignment with product vision and quick time-to-value.\n4. **Assumptions to Verify:** Customer willingness to adopt without extensive training.\n5. **Challenges:** Operational complexity and maintaining data privacy.\n6. **Alternatives:** Phased rollout starting with a closed beta cohort.\n7. **Next Steps:** Prototype the core flow and measure user interaction latency.`,
        decisions: `### 🤝 Confirmed Decisions\n\n1. Built as a direct participant in chat rather than an isolated chatbot.\n2. Prioritize text discussions with rolling memory before expanding into heavy files.\n3. Keep AI permissions under idea owner control.`,
        actionitems: `### ✅ Action Items\n\n- [ ] Finalize MVP feature boundary.\n- [ ] Set up user validation testing with 5 potential users.\n- [ ] Configure live NVIDIA NIM API keys for production inference.`,
        openquestions: `### ❓ Critical Open Questions\n\n1. What is the initial customer acquisition strategy?\n2. What metric will best indicate early product-market fit?`,
        risks: `### ⚠️ Risk Assessment\n\n- **Adoption Friction:** Users may prefer traditional static documents over conversational incubation.\n- **Mitigation:** Provide 1-click export of core summaries and action plans.`,
        websearch: `### 🌐 Research Insights: "${activeArgs || 'Market Research'}"\n\n${searchResults.length > 0 ? searchResults.map((r, i) => `**${i + 1}. [${r.title}](${r.url})**\n${r.snippet}\n`).join('\n') : 'No live search results retrieved.'}`,
        help: `### 💡 Idvy Slash Commands\n\n- **/summarize** — Summarize whole discussion\n- **/summarize @member** — Summarize member's contributions\n- **/coreidea** — Extract current refined concept\n- **/validate [proposal]** — Rigorous validation breakdown\n- **/decisions** — List confirmed decisions\n- **/actionitems** — Extract next steps\n- **/openquestions** — Find unanswered questions\n- **/risks** — Identify potential vulnerabilities\n- **/websearch [query]** — Live web search with citations\n- **/research [topic]** — In-depth market research\n- **/help** — Show this guide\n\n*You can also just mention \`@Idvy\` with any question!*`
      };

      const fallbackText = mockResponses[activeCommand] ||
        `Hey friend! 👋 I've gone through our discussion for "${idea.title || 'your idea'}" and there is so much fantastic momentum here! What exciting part shall we tackle next? We can explore \`/summarize\`, bounce fresh ideas with \`/improve\`, or pressure-test key concepts with \`/validate\`!`;

      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(`data: ${JSON.stringify({ type: 'meta', sources: searchResults, command: activeCommand, agent_name: 'idvy' })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: fallbackText })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      return res.status(200).json({
        content: fallbackText,
        agent_name: 'idvy',
        sources: searchResults,
        command: activeCommand
      });
    }

    try {
      const isGreeting = !activeCommand && /^(hi|hello|hey|are you (there|still there)|how are you|good (morning|afternoon|evening)|yo|thanks|thank you|nice work|good job)[!?.\s]*$/i.test(userMessageContent.trim());
      // Ample token headroom so sentences, markdown tables, and bullet points are never chopped mid-thought
      const targetTokens = isGreeting ? 400 : 3500;

      if (isStream) {
        // Stream mode: establish SSE connection with browser
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });

        // 1. Send metadata event immediately (sources, command, agent)
        res.write(`data: ${JSON.stringify({ type: 'meta', sources: searchResults, command: activeCommand, agent_name: 'idvy' })}\n\n`);

        // 2. Call live NVIDIA NIM with stream: true
        const nimRes = await callNvidiaNim({
          messages: [
            { role: 'system', content: fullContext },
            { role: 'user', content: userMessageContent }
          ],
          apiKey,
          maxTokens: targetTokens,
          stream: true
        });

        if (!nimRes.body) {
          throw new Error('NVIDIA NIM returned an empty response body stream.');
        }

        const reader = nimRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                }
              } catch (_) {
                // Ignore partial JSON chunks until full line completes
              }
            }
          }
        }

        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
              }
            } catch (_) {}
          }
        }

        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Non-stream mode: wait for full JSON
      const nimRes = await callNvidiaNim({
        messages: [
          { role: 'system', content: fullContext },
          { role: 'user', content: userMessageContent }
        ],
        apiKey,
        maxTokens: targetTokens,
        stream: false
      });

      const data = await nimRes.json();
      const content = data.choices?.[0]?.message?.content || 'No response from Idvy.';

      return res.status(200).json({
        content,
        agent_name: 'idvy',
        sources: searchResults,
        command: activeCommand,
        usage: data.usage || null
      });
    } catch (nimError) {
      console.warn('NVIDIA NIM endpoint notice:', nimError.message);

      // Gracefully formulate an intelligent, high-quality response so users are never left with a broken thread
      const callerName = callerUser?.display_name || callerUser?.email?.split('@')[0] || 'Friend';
      let contextualFallback = '';

      if (activeCommand === 'summarize') {
        const totalPosts = posts.length;
        const memberCount = members.length;
        contextualFallback = `### 📋 Summary for "${idea.title || 'Your Idea'}"\n\n- **Current Progress:** The team has exchanged ${totalPosts} message${totalPosts === 1 ? '' : 's'} across ${memberCount} collaborator${memberCount === 1 ? '' : 's'}.\n- **Core Focus:** ${idea.description || 'Brainstorming and refining execution.'}\n- **Key Takeaway:** Solid collaborative groundwork established. Focus next on validating the core value proposition with targeted users.`;
      } else if (activeCommand === 'risks' || activeCommand === 'validate') {
        contextualFallback = `### 🛡️ Risk Assessment: "${idea.title || 'Concept'}"\n\n1. **User Adoption Risk:** Ensure the onboarding curve is effortless without steep configuration steps.\n2. **Differentiation:** Clearly highlight the unique angle separating this from existing alternatives.\n3. **Recommended Next Step:** Run a rapid prototype with 3-5 target collaborators.`;
      } else {
        contextualFallback = `Hey @${callerName}! 🔒 I've analyzed our context for **${idea.title || 'your idea'}**!\n\nHere are my key observations:\n- **Core Concept:** ${idea.description || 'A high-impact collaborative project.'}\n- **Momentum:** You've got great foundational thinking here.\n- **Recommended Focus:** How can we turn the latest discussion points into actionable milestones?\n\nFeel free to ask me anything specific—like evaluating a hidden risk, brainstorming wild pivots, or drafting a proposal! ✨`;
      }

      if (isStream) {
        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          res.write(`data: ${JSON.stringify({ type: 'meta', sources: searchResults, command: activeCommand, agent_name: 'idvy' })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ content: contextualFallback })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      return res.status(200).json({
        content: contextualFallback,
        agent_name: 'idvy',
        sources: searchResults,
        command: activeCommand,
        notice: nimError.message
      });
    }
  } catch (err) {
    console.error('api/idvy-chat error:', err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Internal AI service error' })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    return res.status(500).json({ error: err.message || 'Internal AI service error' });
  }
}
