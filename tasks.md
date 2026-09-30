# Idvy — Complete Implementation Plan for Ideate

Phase 1: AI Integration

NVIDIA NIM

## 1. Objective

Integrate Idvy, the AI Idea Collaborator, into Ideate as a default participant in every newly created idea.

Idvy should understand the complete discussion within an idea, respond when mentioned, summarize conversations, analyze members' suggestions, and help users develop their ideas through natural language and slash commands.

The first implementation will focus exclusively on text-based conversations. Document, image, and audio analysis will be added in a later phase.

The goal is to make Idvy feel like a real collaborator in the discussion, rather than a separate chatbot that users must manually open and provide context to.

## 2. Scope of the first release

Included in Phase 1

In scope

* Automatic addition of Idvy to every new idea.

* Default welcome message.

* `@Idvy` mentions and responses.

* Complete text discussion context.

* Conversation summarization.

* Member-specific summarization.

* Suggestion validation.

* Core idea extraction.

* Decision and action-item extraction.

* Web search and research.

* Slash command system.

* Owner-controlled AI access.

* AI response persistence in chat.

* Streaming responses.

* Error handling and usage tracking.

* Responsive UI for desktop and mobile.

Deferred to later phases

Out of scope

* Document and PDF analysis.

* Image understanding.

* Voice-note transcription and analysis.

* Voice generation and `/viavoice`.

* Nick application-level operations.

* Autonomous background agents.

* Automated task execution.

* Complex multi-agent workflows.

# 3. Technical architecture

Use the existing React + Vite + Supabase + Vercel stack. No separate always-running backend server is required.

### Ideate Frontend

React · Chat UI · @Idvy · Slash commands

Supabase Edge Function

Authentication · Authorization · Context preparation · AI orchestration

Context Engine

Idea details · Full chat history · Member attribution · Rolling summary

### NVIDIA NIM

Nemotron 3 Ultra 550B A55B

Reasoning · Response generation · Command execution planning

Supabase Database

Persist AI response · Update memory · Record usage

### Security requirement

The NVIDIA API key previously shared in the conversation must be revoked and replaced before deployment. Store the replacement as a Supabase Edge Function secret. Never expose it in React environment variables, frontend requests, or Git.

# 4. Phase-by-phase implementation

## Phase 1 — NVIDIA NIM integration

Foundation

First, establish a secure connection between Supabase and NVIDIA NIM.

### Tasks

1. Create a Supabase Edge Function named `idvy-chat`.

2. Configure the NVIDIA API key as a server-side secret.

3. Configure the model identifier centrally.

4. Implement the OpenAI-compatible chat completions request.

5. Support streaming responses.

6. Handle authentication errors, rate limits, timeouts, and model failures.

7. Add request logging and usage tracking.

8. Create a shared AI service that future features can reuse.

Suggested configuration:

```
NVIDIA_API_KEY=<stored as Supabase secret>
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

### Expected result

The application can securely send a prompt to NVIDIA NIM and receive a response through Supabase without exposing credentials to the browser.

## Phase 2 — Automatically add Idvy to every idea

Core functionality

Whenever a user creates an idea, Idvy should automatically become an AI participant.

### Required behavior

1. User creates an idea.

2. The application creates the idea record.

3. Idvy is enabled by default for that idea.

4. The default AI permissions are initialized.

5. A welcome message is added to the discussion.

6. The idea opens with Idvy visible in the participant list.

This process should be atomic or safely retryable, so a failed welcome-message insertion does not result in duplicate AI participants or duplicate greetings.

### Welcome message

Idvy

AI Collaborator · System message

AI

Hey everyone! I'm Idvy, your AI collaborator.

I'll follow the discussions in this idea and help you organize thoughts, summarize conversations, research topics, and evaluate suggestions.

Just mention @Idvy or use a slash command whenever you need assistance.

I'll be here whenever you need a second perspective. Let's build something meaningful together!

### Database changes

Reuse the existing message table. Add an appropriate sender type or metadata field to distinguish AI-generated messages from human messages.

For example:

```
sender_type: user | ai | system
agent_name: idvy
```

Do not create a separate chat system for Idvy. Its messages should appear in the existing idea discussion.

## Phase 3 — Build the conversation context engine

Most important component

This is the core of Idvy.

When a member mentions Idvy, it should understand the entire idea, including the discussion that happened before the current message.

### Context to provide

|
Context

|

Description

|
| --- | --- |
|

Idea title

|

Name of the idea

|
|

Idea description

|

Current description

|
|

Idea creator

|

Owner information

|
|

Members

|

Authorized participants

|
|

Full discussion

|

All relevant text messages

|
|

Message attribution

|

Who said what

|
|

Timestamps

|

When messages were posted

|
|

Previous AI responses

|

Idvy's earlier contributions

|
|

Rolling summary

|

Consolidated understanding of the discussion

|
|

Current request

|

The user's latest question or command

|

### Example

Suppose a discussion contains:

* Rahul proposes a local clothing marketplace.

* Chinna suggests adding Instagram storefronts.

* Vinay proposes WhatsApp communities.

* Rahul later suggests removing delivery functionality from the initial version.

When asked:

`@Idvy What is our current idea?`

Idvy should understand the evolution and return the current concept, not merely summarize the first message.

### Context management strategy

For small discussions, include the complete transcript.

As conversations grow:

1. Maintain a rolling discussion summary.

2. Include recent messages verbatim.

3. Retrieve relevant historical messages when needed.

4. Preserve references to the original message IDs.

5. Refresh memory after edits or deletions.

6. Never treat a summary as a substitute for the canonical message history.

This prevents context loss while controlling token consumption and response latency.

### New database table: `idea_ai_memory`

|
Field

|

Purpose

|
| --- | --- |
|

`idea_id`

|

Associated idea

|
|

`core_idea`

|

Current understanding

|
|

`discussion_summary`

|

Consolidated history

|
|

`member_contributions`

|

Member-specific insights

|
|

`decisions`

|

Confirmed decisions

|
|

`open_questions`

|

Unresolved issues

|
|

`action_items`

|

Proposed next steps

|
|

`last_processed_message_id`

|

Memory synchronization

|
|

`updated_at`

|

Last update

|

Memory updates should run asynchronously where possible. A temporary memory-update failure must not prevent the user from receiving an otherwise valid AI response.

## Phase 4 — Implement @Idvy mentions

### UI requirements

* Add `@Idvy` to the mention autocomplete.

* Display Idvy with a distinctive purple avatar.

* Label its responses as AI-generated.

* Show a typing indicator while processing.

* Support streaming responses.

* Persist the completed response.

* Provide retry behavior if a request fails.

### Interaction flow

Rahul

`@Idvy What are the main challenges in our idea?`

Idvy is reviewing the discussion...

Idvy

Based on your discussion, I identified three areas that need attention:

1. Customer acquisition.

2. Differentiation from existing solutions.

3. Operational feasibility.

These are preliminary observations based on the conversation. We can investigate each one further using `/websearch`.

### Important behavior

Idvy should respond only when:

* It is explicitly mentioned.

* A recognized slash command is used.

* The application invokes a permitted AI operation.

It should not automatically respond to every human message. This avoids cluttering the discussion and unnecessary model usage.

# 5. Phase 5 — Slash command framework

Instead of implementing every command independently, create a reusable command registry.

Each command should define:

* Command name.

* Required arguments.

* Permission requirements.

* Context requirements.

* Execution handler.

* Response format.

* Whether external tools are needed.

* Whether the operation changes persistent data.

### Initial command list

|
Command

|

Function

|

Priority

|
| --- | --- | --- |
|

`/summarize`

|

Summarize the entire discussion

|

P0

|
|

`/summarize @member`

|

Summarize one member's contributions

|

P0

|
|

`/coreidea`

|

Extract the current core idea

|

P0

|
|

`/validate`

|

Evaluate a proposal

|

P0

|
|

`/validate @member`

|

Evaluate a member's contribution

|

P0

|
|

`/decisions`

|

Extract decisions

|

P1

|
|

`/actionitems`

|

Extract proposed action items

|

P1

|
|

`/openquestions`

|

Identify unanswered questions

|

P1

|
|

`/improve`

|

Suggest improvements

|

P1

|
|

`/risks`

|

Identify risks

|

P1

|
|

`/websearch`

|

Search the web

|

P1

|
|

`/research`

|

Conduct deeper research

|

P1

|
|

`/feasibility`

|

Evaluate feasibility

|

P2

|
|

`/competitors`

|

Research competitors

|

P2

|
|

`/timeline`

|

Suggest a timeline

|

P2

|
|

`/help`

|

Display command documentation

|

P0

|

### Command execution example

User enters:

```
/summarize @Rahul
```

The application should:

1. Parse the command.

2. Resolve Rahul to a real member ID.

3. Retrieve the member's messages within the current idea.

4. Prepare context.

5. Send the request to Idvy.

6. Generate a structured summary.

7. Persist the response in the chat.

Do not rely on the LLM alone to determine which messages belong to a user. Resolve identities and retrieve the relevant messages in the backend.

# 6. Phase 6 — Suggestion validation

The `/validate` command should be one of Idvy's signature features.

### Required output format

Every validation response should include:

1. Suggestion: What is being evaluated?

2. Interpretation: What does the member actually propose?

3. Strengths: What is potentially useful?

4. Assumptions: What needs verification?

5. Challenges: What could go wrong?

6. Alternatives: What other approaches exist?

7. Next steps: What should the group investigate?

For validation that requires market or technical evidence, Idvy must use external research rather than presenting unsupported assumptions as facts.

Avoid reducing validation to a simplistic numerical score. The purpose is to help members reason through their ideas.

# 7. Phase 7 — Web search integration

Idvy should be able to research a topic without users leaving the idea discussion.

### Example

```
/websearch AI-powered social media management tools for small businesses
```

### Execution

1. Parse the search query.

2. Call the configured search provider from a secure backend.

3. Retrieve relevant results.

4. Extract titles, snippets, and URLs.

5. Pass the retrieved material to Nemotron.

6. Ask Idvy to synthesize findings in the context of the current idea.

7. Include source links in the response.

8. Persist the response and research metadata.

### Response format

* Research question.

* Key findings.

* Relevance to the idea.

* Existing alternatives.

* Potential opportunities.

* Risks and limitations.

* Source links.

Retrieved webpage content must be treated as untrusted input, not as instructions to the agent.

# 8. Phase 8 — AI access management

The idea owner must be able to control which members can interact with Idvy.

### Commands

```
/give.ai.accto @member
/revoke.ai.accto @member
/ai.access
/ai.enable
/ai.disable
```

### Requirements

* AI is enabled by default for new ideas.

* The owner has full AI-management permissions.

* Members can use Idvy only if authorized.

* The owner can grant access to individual members.

* The owner can revoke access at any time.

* The server verifies permissions for every AI request.

* Unauthorized requests are rejected even if manually submitted through the API.

* AI access and idea membership remain separate permissions.

* The UI displays the current AI access state.

When AI access is revoked, future requests must be denied immediately. Historical discussion messages should not be deleted as a side effect.

# 9. Phase 9 — Frontend design

Maintain the existing Ideate chat interface.

### Idvy visual identity

* Purple avatar and accent color.

* Consistent AI label.

* Distinctive styling for AI responses.

* Clear streaming and processing states.

* Source citations for web research.

* Expandable long responses.

* Retry and error handling.

### Required components

* `IdvyAvatar`

* `IdvyMessage`

* `IdvyTypingIndicator`

* `MentionAutocomplete`

* `SlashCommandMenu`

* `AIResponseRenderer`

* `AISettingsPanel`

* `AIAccessManager`

* `AIErrorState`

* `AIUsageIndicator`

Ensure all components work on desktop and mobile.

# 10. Phase 10 — Security, reliability, and testing

### Security

* Keep the NVIDIA API key server-side.

* Authenticate every request.

* Validate idea membership.

* Validate AI permissions.

* Prevent cross-idea context leakage.

* Apply rate limits.

* Validate command arguments.

* Restrict database access through RLS.

* Avoid logging secrets or unnecessary sensitive content.

* Treat user messages and retrieved webpages as untrusted input.

* Require confirmation before any future persistent modification.

### Reliability

* Add request timeouts.

* Handle model errors.

* Handle partial streaming failures.

* Prevent duplicate AI messages.

* Support safe retries.

* Track request status.

* Record token usage when available.

* Make memory updates retryable.

* Provide user-friendly failure messages.

### Acceptance tests

1. A newly created idea automatically includes Idvy.

2. Idvy posts exactly one welcome message.

3. Idvy answers questions using the correct idea's conversation.

4. Idvy can summarize the entire discussion.

5. Idvy can summarize a specific member's contributions.

6. Idvy can evaluate a specific message.

7. Idvy can distinguish between suggestions and confirmed decisions.

8. Web research includes source links.

9. Unauthorized users cannot invoke Idvy.

10. The AI cannot access another idea's private messages.

11. The owner can grant and revoke AI access.

12. AI responses persist correctly.

13. Streaming works on desktop and mobile.

14. Model failures do not corrupt chat history.

15. The NVIDIA API key is never exposed to the frontend.

16. Existing chat and notification functionality remains unaffected.

# 11. Definition of done

Idvy's first release is complete when a user can create an idea, see Idvy automatically added to its discussion, and ask questions that are answered using the full authorized conversation history.

The owner can control member access, and users can invoke summarization, validation, and research commands directly inside the chat.

The implementation must be secure, responsive, persistent, and deployable on the existing Ideate infrastructure.

Do not begin Nick's implementation or multimodal file processing until Idvy's core functionality and access controls have passed testing.

# 12. Recommended implementation sequence

## Build in this order

1. Secure NVIDIA connection — Establish the NIM service through Supabase.

2. Automatic Idvy membership — Add the agent and welcome message to newly created ideas.

3. Full chat context — Make Idvy understand the discussion before responding.

4. @Idvy integration — Enable natural conversation inside the existing chat.

5. Memory system — Preserve the core idea as conversations grow.

6. Slash commands — Start with summarization, core idea extraction, and validation.

7. AI access control — Let the idea owner manage permissions.

8. Web research — Add external evidence and citations.

9. Testing and deployment — Verify security, reliability, and mobile responsiveness.

The most important implementation decision: Build Idvy as an AI participant in the existing chat, not as a separate chatbot. That single decision keeps the experience aligned with Ideate's original purpose: a shared space where ideas evolve through conversations between people and AI.

# 13. Active Task List & Roadmap

### Current Tasks
- [x] **Cross-Account Chat Visibility**: Ensure collaborators see all messages from all members and Idvy in shared ideas without schema/column errors (`decodePostContent` & standard queries).
- [x] **Global & Per-Idea Pause Controls**: Support pausing Idvy at idea level and platform-wide global level.
- [x] **Admin Pause Lock**: When an admin pauses Idvy (global or idea-level), standard users and idea owners cannot override or resume.
- [x] **Admin Governance**:
  - [x] Admin can grant or revoke AI access per user in the Admin Dashboard.
  - [x] Admin has full author-level privileges on all ideas (edit, delete, manage members).
  - [x] Admin can view all chats in all ideas directly.
- [x] **Member AI Access Default**: By default, only idea owners and admins have access to Idvy and Off-the-Record chat; members require explicit access granted via AI Permissions.
- [x] **Natural Language Chat Posting from Off-the-Record**: Idvy detects instructions like *"send message in chat about how to work as a team"* or *"cheer up the team in chat"*, formulates the message, and posts it into public idea discussion.

### New Tasks (Post-Current Queue)
- [x] **Elevate Off-the-Record Answer Styling**: Upgrade Idvy's response card in the Off-the-Record drawer with premium typography, larger comfortable font (`text-[13.5px]`), spacious leading, polished headings with icons, modern callouts, and clean table borders.
- [x] **Clean User Bubble (No Header)**: Ensure user messages in Off-the-Record chat display with no top header (`You`, `Off-the-record`), showing only the message content and timestamp at the bottom right.
- [x] **Remove Header from Private Message Sidebar**: Remove the bulky top header bar from the Off-the-Record sidebar for a clean, distraction-free modern look with sleek floating controls.
- [x] **/inidchat Command**: Add `/inidchat [instruction]` command in private chat to have Idvy post directly into idea chat acting as an independent collaborator (never saying she was told to do so).
- [x] **Modern In-App Notice Modal**: Replace native browser `alert()` popups with an elegant `NoticeModal` dialog for AI access warnings, administrator lockouts, and diagnostics.
- [x] **Ask Idvy in OTR from Chat Messages**: Add an "Ask Idvy in OTR" action button on every message in the main chat timeline to discuss that specific message with Idvy privately.
- [x] **Revamped Send to Chat Actions**: Remove the unstyled "Shared from Off-the-Record" human post. Support sending text directly to the user's main composer input box for editing, or posting directly as Idvy's native styled answer.
- [x] **Restrict Tagging Access to Members**: Exclude `@Idvy` from mention autocomplete for members without AI access and block tagged submissions at the source with an in-app notice modal instead of public bot messages.
- [x] **Add options to ideas in sidebars to delete, and edit ideas**: Visible 3-dots action menu on all ideas in "My Ideas" and "Shared with Me" for owners and admins to edit or delete ideas directly from the sidebar.
- [x] **Move Bell Icon in Idea Chat Header**: Repositioned Mute/Unmute Bell button right beside the Settings button in the chat header for intuitive access.
- [x] **Ask in OTR for Authorized Members**: Verified cross-account & cross-device AI access check in `checkAIAccess` so members granted AI access can use "Ask in OTR" and the Off-the-Record drawer.
- [x] **Rich Markdown Formatting for Shared Posts in Main Chat**: Complete structured parser in `PostItem.jsx` supporting bold, italics, inline code, links, blockquotes, headings, bullet lists, numbered lists, and fenced code blocks so shared answers are beautifully styled.
- [x] **Three Sharing Actions from Off-the-Record**:
  - `Send to Input Box`: Copies text into main chat composer for user review and editing.
  - `Post as Idvy`: Instantly posts into public chat as Idvy's native styled answer card.
  - `Answer in Main Chat`: Directly prompts Idvy to answer the same question publicly in the main discussion.
- [x] **Full Answer Display Without Truncation**: Removed client-side slice truncation (`content.slice(0, 2400)`) in `IdvyMessage.jsx` and increased model `maxTokens` to `3500` across all backend handlers (`server/idvyCore.js`, `api/idvy-chat.js`, `supabase/functions/idvy-chat/index.ts`).
- [x] **Granular AI Access Control (Off-Chat vs. Tagging)**:
  - Granular control over member's access to Idvy: **Off-chat access** (`can_use_otr`) and **Tagging access** (`can_tag_ai`) managed independently.
  - Idea owner can grant/revoke either permission individually or both together via the revamped AI Access Manager modal (`AIAccessManagerModal.jsx`).
  - Chat commands added in `DiscussionView.jsx`: `/give.ai.accto @member [otr|tag]` and `/revoke.ai.accto @member [otr|tag]`.
- [x] **Slash Command Selection via Enter Key in OTR**: Fixed keyboard handling in `IdvyPrivateSidebar.jsx` and `SlashCommandMenu.jsx` so pressing `Enter` or `Tab` immediately inserts the highlighted command and sets cursor position correctly.
- [x] **"Ask in OTR" Visibility Enforcement**: "Ask in OTR" action button in `PostItem.jsx` is strictly conditioned on `canUseOTR` in both message quick actions and options dropdown, hiding it completely for members without off-chat permissions.
- [x] **Real-Time Cross-Device Permission Synchronization**: Permission changes broadcast instantly via Supabase Realtime system sync posts (`agent_name: 'ai_permissions'`), automatically updating members' UI and access permissions in real-time without requiring re-login or manual refresh.
- [x] **Fix Blank Screen on Opening Off-the-Record Chat**:
  - Protected `IdvyPrivateSidebar` against runtime crashes: guarded `idea?.title`, sanitized message storage loading (fall back to initial welcome greeting if empty or malformed), guarded `members.map` and `member.display_name`.
  - Added full defensive error handling to `renderFormattedMarkdown` and `renderInlineMarkdown` for table cells and malformed syntax.
  - Wrapped `IdvyPrivateSidebar` in a new React `ErrorBoundary` in `DiscussionView.jsx` to prevent any subcomponent error from blanking the application.
  - Added missing `IDVY_SLASH_COMMANDS` import from `aiService.js` in `IdvyPrivateSidebar.jsx` (which previously caused a `ReferenceError` when opening OTR).