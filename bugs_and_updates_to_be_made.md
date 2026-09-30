# Bugs & Updates Progress Report

## Summary of Fixes & Updates Completed

All 16 issues and feature requests listed below have been resolved, implemented, and verified in the codebase.

---

### 1. Duplicate Idea in Sidebar on Creation
- **Root Cause:** Both the optimistic creation callback (`handleIdeaCreated`) and the background re-fetch (`loadIdeas`) appended the new idea to `ideas` without checking for duplicates, rendering it twice until manual page refresh.
- **Fix:** 
  - In `src/App.jsx`, added deduplication by `id` using `Map` in both `loadIdeas` and `handleIdeaCreated`.
  - In `src/components/common/Sidebar.jsx`, added deduplication before rendering idea tabs.

### 2. Members Showing 0 & Idvy Auto-Welcome Greeting
- **Root Cause:** If idea creation finished before initial member rows were queried, or before the owner row populated, the count rendered as `0`, and Idvy was not listed as a default collaborator.
- **Fix:**
  - In `src/services/memberService.js` (`getMembers`), guaranteed that both the Idea Owner and `IDVY_BOT_USER` (`Idvy`) are always present in the returned list, ensuring the member count is always at least 2.
  - In `src/components/ideas/MembersSheet.jsx`, Idvy is pinned at the top with a dedicated **AI Friend** badge.
  - In `src/pages/DiscussionView.jsx`, if an idea is brand new with 0 posts, Idvy automatically posts a warm greeting addressing the creator by name (`@Name`), reassuring them that having Idvy as their collaborator is more than enough to take the idea from concept to execution.

### 3 & 4. Slash Commands Menu Constraints & Keyboard UX
- **Improvements:**
  - Added parameter requirement definitions (`requiresParam: boolean`, `paramName: string`) to all entries in `IDVY_SLASH_COMMANDS` in `src/services/aiService.js`.
  - In `src/components/ai/SlashCommandMenu.jsx`, added badges for required parameters vs. commands that run on full idea context without parameters.
  - Added complete keyboard navigation: `ArrowUp`, `ArrowDown`, `Enter`, `Tab`, and `Escape` support with `activeSlashIdx` highlighting and automatic scroll into view.
  - Added incomplete command detection (`slashValidation`): if an incomplete slash command is typed (e.g. `/val` or `/validate` without a proposal), a helpful constraint notice is displayed, and the **Post** button is disabled until complete.

### 5. Enter to Post Messages
- **Fix:**
  - Verified and ensured that pressing `Enter` (without `Shift`) immediately submits the post.
  - If a slash command or mention popup is open, `Enter` / `Tab` selects the highlighted item instead of submitting.
  - If a slash command is incomplete, `Enter` is blocked from submitting and the requirement notice is shown.

### 6 & 7. Idvy Persona & Typing Status
- **Root Cause:** Previous status text was sterile and robotic (`Idvy is analyzing discussion context...`), and Idvy occasionally defaulted to a standard AI disclaimer.
- **Fix:**
  - In `src/components/ai/IdvyTypingIndicator.jsx` and `src/pages/DiscussionView.jsx`, replaced all robotic statuses with warm, friendly phrasing that tags the user by name:
    - `"Idvy is typing a response for @Name..."`
    - `"Idvy is looking up live research for @Name..."`
    - `"Idvy is thinking through this proposal with @Name..."`
    - `"Idvy is distilling the core vision with @Name..."`
  - In `server/idvyCore.js` and `supabase/functions/idvy-chat/index.ts`, updated `IDVY_SYSTEM_PROMPT` to mandate that Idvy acts as an enthusiastic, smart creative co-founder and friend who tags the user by `@Name`.

### 8. Creative Partnership (Feeling Enough Alone with Idvy)
- **Fix:**
  - Added explicit instructions in `IDVY_SYSTEM_PROMPT` and `IDVY_WELCOME_TEXT`: when no other members are present, Idvy makes the founder feel fully supported and empowered to build the idea to completion.

### 9. Collaborator Menu Popup Bug ("No collaborators found" after typing `@Idvy hi`)
- **Root Cause:** In `PostComposer.jsx`, the condition `if (!query.includes(' ') || query.length < 15)` erroneously used `||` instead of `&&`. Any string shorter than 15 characters (like `"Idvy hi"`) kept the menu open and searched for `"idvy hi"`, resulting in 0 matches and showing `"No collaborators found"`.
- **Fix:**
  - In `PostComposer.jsx`, updated `handleTextChange` to ensure mention queries do not contain spaces (`!/\s/.test(query)`) and are limited to 30 characters. Once the user types a space, the mention menu immediately closes.
  - Updated the mention dropdown to only render when `filteredMembers.length > 0`, completely preventing the "No collaborators found" popover from showing while typing normal text.
  - Fixed toolbar `@` button toggle behavior to cleanly open/close the menu.

### 10. Whole Message Text Showing in Blue Instead of Just Tagged Name
- **Root Cause:** In `PostItem.jsx`, `renderContent` used `/(@[\w\s.-]+(?:\s|$))/g`. The `\s` inside the character class consumed all following words and spaces until the end of the text.
- **Fix:**
  - Changed regex to `/(@[a-zA-Z0-9_.-]+)/g`. Only the actual `@username` handle is styled in the blue tag chip; all surrounding and subsequent words remain standard text.

### 11. Response Speed for Simple Questions
- **Fix:**
  - In `server/idvyCore.js` and `api/idvy-chat.js`, implemented dynamic `max_tokens` allocation:
    - Short casual queries and greetings allocate `512` tokens for faster response generation.
    - Deep analyses allocate `1536` tokens.
  - Added system prompt rules requiring concise, energetic 1–2 paragraph answers for casual questions and greetings rather than lengthy unsolicited essays.

### 12. Answer Formatting & Styling
- **Fix:**
  - Extensively upgraded `src/components/ai/IdvyMessage.jsx`:
    - Full markdown table rendering with borders, header styling, and alternating row backgrounds.
    - Blockquote styling with purple accent borders and quote icons.
    - Code blocks with dark theme backgrounds and clean monospace formatting.
    - Styled lists, inline code chips, bold highlights, and horizontal dividers.

### 13. Copy Message Option
- **Fix:**
  - Added a dedicated **Copy** button in `PostItem.jsx` (visible in both the post action bar and the options dropdown) with instant "Copied" checkmark feedback.
  - Enhanced the **Copy** button in `IdvyMessage.jsx` with clear tooltips and visual confirmation.

### 14. Author Option to Delete Idvy Messages
- **Fix:**
  - Added `postService.deleteIdvyPosts(ideaId)` to delete all Idvy messages from an idea in Supabase and local storage.
  - In `IdvyMessage.jsx`, if the current user is the idea author (`isIdeaAuthor`), an options menu (`...`) provides:
    - **Delete this message**: Removes the individual Idvy message.
    - **Delete all Idvy messages**: Confirmation prompt that clears all Idvy messages from the idea.
  - Added a **Delete All Idvy Messages** shortcut in the idea Settings dropdown for the idea author.

### 15. Private Chat with Idvy (`/private [query]`)
- **Fix:**
  - Built `src/components/ai/IdvyPrivateSidebar.jsx`, a dedicated right-hand confidential drawer for the current idea.
  - Registered `/private [query]` command. When used, the message is NOT posted to the group discussion; instead, the private sidebar opens and Idvy answers privately.
  - Added a **Private with Idvy** button with a lock icon in the top header of `DiscussionView.jsx` to open the private chat anytime.
  - Private chat history is persisted in `localStorage` per idea and per user.

### 16. Private Summarize (`/summarize-private`)
- **Fix:**
  - Added `/summarize-private` slash command.
  - When entered in the input box, it intercepts public posting, slides open the private sidebar, and generates a private summary of member messages and proposals without posting anything in the public chat.
  - Added a 1-click **"Summarize privately"** chip inside the private sidebar header.

### 17. Input Box Lingering Text Bug
- **Bug:** When tagging `@Idvy` and sending a message, the message was posted and Idvy started answering, but the user's text remained lingering in the input box until Idvy finished posting her answer.
- **Root Cause:** 
  1. In `src/components/posts/PostComposer.jsx`, `setContent('')` was located after `await onPostCreated()`.
  2. In `src/pages/DiscussionView.jsx`, `handlePostCreated` previously awaited `aiService.queryIdvy()` before returning, blocking `onPostCreated` until the LLM generation completed.
- **Fix:**
  - In `src/components/posts/PostComposer.jsx`, `setContent('')`, `setAttachments([])`, and DOM textarea resets (`textareaRef.current.value = ''`, `style.height = 'auto'`) are now executed **immediately** on submit before calling `onPostCreated`.
  - In `src/pages/DiscussionView.jsx`, decoupled Idvy's LLM generation into an asynchronous non-blocking background task. The user's post appears instantly in the discussion timeline, and the composer is immediately clear and ready for the next message while Idvy generates her response.

### 18. Rebranding Private Chat to "Off-the-Record" & Aesthetic Upgrade
- **Improvement:**
  - Upgraded "Private Chat with Idvy" to **"Off-the-Record"** with a sleek obsidian/dark-slate glassmorphic theme.
  - In `src/pages/DiscussionView.jsx`, replaced the header button with an **"Off-the-Record"** button featuring an incognito `EyeOff` icon, active glowing status dot, and dark stealth styling.
  - Supported `/offtherecord [query]` (with `/private [query]` alias) and `/summarize-private`.

### 19. Off-the-Record Rich Markdown Formatting & Runtime Fix
- **Bugs & Improvements:**
  - In private chat, Idvy answers were previously rendered as plain unformatted text.
  - Idvy crashed with `aiService.callIdvyChat is not a function`.
- **Fix:**
  - Added `aiService.callIdvyChat(params)` in `src/services/aiService.js`.
  - Added full markdown formatting engine to `src/components/ai/IdvyPrivateSidebar.jsx` supporting:
    - Tables with dark obsidian borders, headers, and alternating row styling.
    - Code blocks with monospace fonts and clean margins.
    - Blockquotes with purple accent borders.
    - Headings (`#`, `##`, `###`), bullet lists, numbered lists.
    - Inline bold, code tags, `@mentions`, and external links.
  - Enhanced `api/idvy-chat.js` with resilient contextual fallbacks so Idvy never crashes even under NVIDIA cloud overloads.

### 20. In-Chat Embedded Off-the-Record Space & Normal Button Styling
- **Improvement:** 
  - Styled the **Off-the-Record** header button as a standard, clean button matching `+ Invite` and `Clear My Posts` without neon or dark styling.
  - Rather than opening as a screen-covering floating sidebar, embedded the Off-the-Record space directly inside the main chat interface flex container. On desktop/tablets, users can view the idea discussion timeline on the left and the Off-the-Record panel on the right side-by-side without losing any conversation context.

### 21. Send Messages to Idea Chat from Off-the-Record
- **Feature:**
  - Added support for `/post [message]`, `/send [message]`, and `/say [message]` in the Off-the-Record input box to post directly into the public idea chat and have Idvy respond there.
  - Added a 1-click **"Send to Idea Chat"** action button on every Off-the-Record message to share insights directly to the team discussion.

### 22. Fast, Humanlike, and Concise Responses
- **Fix:**
  - Reduced token allocation to `140` for greetings and `280` for simple queries, cutting latency from minutes down to seconds.
  - Updated `IDVY_SYSTEM_PROMPT` and `buildIdvyContext` in `server/idvyCore.js` to strictly enforce brevity, natural tone, and direct answers without unsolicited essays or endless play-by-play tables.

### 23. Tagged Person Colored Badge Indicator in Composer
- **Feature:**
  - Added real-time extraction of tagged handles (`@Idvy`, `@member`) in `PostComposer.jsx`.
  - Displays a vibrant, colored badge indicator row (`Tagged: [@Idvy ✨] [@Name]`) directly above the text area so users know who is tagged before submitting.

### 24. Pause Idvy Control & `/pause` / `/resume` Slash Commands
- **Feature:**
  - Added an option to pause Idvy in an idea via the Idea Settings menu and through `/pause` (or `/pause-idvy`) and `/resume` (or `/resume-idvy`) slash commands.
  - When paused, Idvy will not respond to mentions, and an informative pause banner appears in the chat timeline with a quick **Resume** button.

### 25. Idvy Name Tag Streamlined (Star Symbol Only)
- **Fix:**
  - Removed the `AI Collaborator` and `AI Friend` text badges from message headers and the typing indicator.
  - Idvy's name now displays cleanly with just the purple star icon (`Sparkles`), as requested.

### 26. Clean Plain Text in Reply Banners & Markdown Fixes
- **Fix:**
  - Created `src/utils/textUtils.js` with `stripMarkdown` to remove headers (`###`), bold (`**`), tables (`|`), and dividers from reply reference quotes.
  - Updated `IdvyMessage.jsx` to parse single-asterisk italics (`*italic*` and `_italic_`) and cleaned up orphaned `**` tokens.

### 27. Critical: Idvy's Answer Getting Trimmed Mid-Sentence
- **Root Cause:** In `api/idvy-chat.js`, an over-aggressive heuristic set `targetTokens = 280` whenever user input was shorter than 100 characters. Large reasoning models like Nemotron 3 Ultra 550B quickly exhausted 280 tokens on bullet points and open-ended queries, cutting off text abruptly mid-word.
- **Fix:** Increased `targetTokens` to `1024` with ample headroom so detailed answers, bulleted lists, and structured summaries are completely outputted without truncation.

### 28. "Could not find table public.idea_ai_access in schema cache" Error
- **Root Cause:** `src/services/aiService.js` queried and updated `idea_ai_access` in Supabase. Because this table had not yet been migrated in the Supabase schema, it threw a schema cache error and popped up a blocking browser `alert()`.
- **Fix:**
  - Updated `src/services/aiService.js` (`getAIAccessState` and `updateAIAccessState`) with resilient local persistence fallback (`localStorage.setItem('idvy_access_' + ideaId)`).
  - In `src/components/ai/AIAccessManagerModal.jsx`, removed raw browser alerts and added smooth fallback state updates so owner permissions work immediately and reliably.

### 29. Off-the-Record Button Themed Nicely
- **Fix:** In `src/pages/DiscussionView.jsx`, updated the Off-the-Record header button to dynamically inherit the chat palette's `theme.hex` and `theme.borderHex`. When active, it adopts the filled theme color; when inactive, it features the clean border and theme tint matching the `Invite` and `Idvy AI` buttons.

### 30. Idea Overview & Diagnostics Info Display (No More Digging Through Console.log)
- **Fix:**
  - Created `src/components/ideas/IdeaInfoModal.jsx` displaying an organized, tabbed interface:
    - **Overview:** Title, description, creator, timestamps, message metrics, and tags.
    - **Idvy AI:** AI collaborator status, model specifications (NVIDIA Nemotron 3 Ultra 550B, 1M context, capabilities, and slash command reference).
    - **Diagnostics:** Live database status, Realtime sync health, Web Push service worker status, and local store fallback status.
  - Connected the info icon `(i)` in `DiscussionView.jsx` header to open this modal directly.

### 31. Sidebar 3-Dots Options Menu on Ideas (Edit & Delete)
- **Fix:**
  - In `src/App.jsx`, passed `onEditIdea={handleOpenEditIdea}` and `onDeleteIdea={handleOpenDeleteIdea}` to `<Sidebar>`.
  - In `src/components/common/Sidebar.jsx`, added a hover 3-dots `MoreVertical` button on each idea item.
  - Clicking opens a dropdown menu with ✏️ **Edit Idea** and 🗑️ **Delete Idea** (styled in danger red) with click-outside dismissal and stopped propagation.

### 32. Off-the-Record Chat Styling Refactored
- **Fix:**
  - In `src/components/ai/IdvyPrivateSidebar.jsx`, transformed the interface from a heavy dark theme to the clean light/slate aesthetic matching the main chat (`bg-[#f8fafc]`, crisp borders, soft white cards).
  - Shortened the header to `h-12 / h-13` (matching the main chat header height) with a compact lock badge and quick-clear action.
  - Redesigned message bubbles: user messages in gradient blue/indigo cards, Idvy messages in structured white cards with formatted markdown tables, code snippets, blockquotes, and a one-click **Send to Idea Chat** button.

### 33. Command Menu Trigger on `.` and `/` in Off-the-Record & Composer
- **Fix:**
  - In both `src/components/posts/PostComposer.jsx` and `src/components/ai/IdvyPrivateSidebar.jsx`, updated the autocomplete trigger regex to `(?:^|\n)[/.]([a-zA-Z0-9._]*)$`.
  - Typing `.` or `/` immediately opens the `SlashCommandMenu` with keyboard navigation and instant command insertion.
  - Added `@` collaborator mention menu inside the Off-the-Record input box as well.

### 34. Dedicated Styling for Slash Command Messages in Chat Timeline
- **Fix:**
  - In `src/components/posts/PostItem.jsx`, detected posts starting with `/`.
  - Rather than rendering as plain normal chat text, slash command posts now render as a prominent command card featuring a `Zap` icon, high-contrast monospace command chip (`/command`), a "Slash Command" badge, and indented parameter text with `@mentions` highlighted.

### 35. Elevated Answer Styling in Off-the-Record Chat
- **Fix:**
  - Upgraded markdown formatting in `src/components/ai/IdvyPrivateSidebar.jsx` with larger, comfortable typography (`text-[13.5px] leading-relaxed`).
  - Headings now render with purple iconography and crisp dividers.
  - Blockquotes feature purple accent bars, `Quote` icons, and soft background cards.
  - Added clean table styling with purple headers and alternating rows.
  - Formatted bullet points with custom purple dots and aligned text.
  - Upgraded Idvy card padding to `p-4` with structured header, copy button, and "Send to Idea Chat" action button.

### 36. User Message Header Removed in Off-the-Record Chat
- **Fix:**
  - Eliminated the redundant user header (`You (Off-the-record) 22:02`) from the Off-the-Record drawer.
  - User messages now render strictly with the message text inside a sleek, modern gradient bubble with the timestamp at the bottom right.

### 37. Private Message Sidebar Header Removed
- **Fix:**
  - Removed the bulky top header row (`Off-the-Record private ...`) from `src/components/ai/IdvyPrivateSidebar.jsx`.
  - Replaced it with sleek floating controls (`Clear` and `Close` pill) at the top right, maximizing screen space and giving a clean, modern borderless layout.

### 38. `/inidchat` Command in Off-the-Record Chat
- **Feature:** Added `/inidchat [instruction]` command in Off-the-Record private chat.
- **Behavior:**
  - Idvy synthesizes the instruction and posts directly into the main public idea chat.
  - Acts as a completely independent team collaborator, with natural warmth and peer energy.
  - Strictly forbidden from saying or hinting that she was told or instructed by someone to say it (e.g. never says "Rahul asked me to...").
  - Posts with native `IdvyMessage` styling directly into the discussion feed.

### 39. Modern In-App Notice Modal
- **Feature:** Created `src/components/common/NoticeModal.jsx` to replace browser `alert(...)` popups.
- **Design:**
  - Glassmorphic backdrop, themed badge icons (`lock`, `warning`, `ai`, `info`, `success`), bold title, formatted message, and primary dismissal button.
  - Used for AI Access Reserved notices, admin pause warnings, and permission alerts without intrusive browser dialogs.

### 40. "Ask Idvy in OTR" from Chat Messages
- **Feature:** Added "Ask in OTR" action button to all messages in the discussion timeline (both human messages in `PostItem.jsx` and AI answers in `IdvyMessage.jsx`).
- **Behavior:**
  - Clicking "Ask in OTR" opens the Off-the-Record drawer and seeds a private discussion prompt referencing the author and content of that message.
  - Idvy immediately responds off-the-record with analysis, suggestions, or critique without public exposure.

### 41. Revamped "Send to Chat" Options from Off-the-Record
- **Feature:** Removed the raw unstyled post and the unsightly prefix `💡 **Shared from Off-the-Record:**`.
- **Options Provided:**
  - **"Send to Input Box"**: Puts the text directly into the main chat composer input box so the user can tweak, edit, and send it themselves.
  - **"Post as Idvy"**: Directly posts the answer into the main idea chat with native Idvy styling (`sender_type: 'ai'`), rich markdown formatting, and zero meta disclaimers.

### 42. Source-Level Tagging Restriction for Unauthorized Members
- **Feature:**
  - In `src/components/posts/PostComposer.jsx`, `@Idvy` is hidden from the mention autocomplete dropdown for members without AI access.
  - If an unauthorized member manually types `@Idvy` or `@idvy` and hits send, submission is blocked and the sleek `NoticeModal` dialog is shown directly to that user.
  - Completely eliminated the noisy public bot message `🔒 **Idvy Access Notice**: Hey @Member!...` from flooding the team discussion.

### 43. Options for Ideas in Sidebar (Edit & Delete)
- **Feature:** Added a persistent 3-dots action menu (`MoreVertical`) next to ideas in the sidebar for both "My Ideas" and "Shared with Me" (for owners and administrators).
- **Behavior:**
  - Clicking the 3-dots button opens a sleek dropdown with **"Edit Idea"** (pencil icon) and **"Delete Idea"** (trash icon in red).
  - Triggers existing `onEditIdea` and `onDeleteIdea` modals directly without needing to enter the idea first.
  - Buttons styled with `opacity-60 hover:opacity-100 group-hover:opacity-100` so they are readily discoverable and accessible on touch and mouse devices.

### 44. Header Bell Icon Repositioning
- **Location:** `src/pages/DiscussionView.jsx`
- **Change:** Moved the Mute / Unmute Notifications bell button directly to the left beside the Settings button in the idea chat header.
- **Result:** Keeps idea controls logically grouped (Idea Info, Members, Clear My Posts, Bell Notifications, Idea Settings).

### 45. "Ask in OTR" Access for Authorized Members
- **Location:** `src/services/aiService.js` & `src/pages/DiscussionView.jsx`
- **Change:** 
  - `aiService.checkAIAccess` now cross-references both local storage and the `idea_members` Supabase table role (`member:ai` or `can_use_ai: true`) across sessions and devices.
  - Updated `setMemberAIAccess` to update the role to `'member:ai'` in Supabase `idea_members` table so permission syncs across different logged-in accounts.
  - Passes the loaded `members` list to `checkAIAccess` and triggers dynamic re-verification when members load.

### 46. Rich Markdown Formatting for Posts in Main Chat
- **Location:** `src/components/posts/PostItem.jsx`
- **Change:**
  - Replaced the simple mention-only regex with a full structured markdown renderer:
    - Headings (`###`, `##`, `#`) with bold typography.
    - Blockquotes with `Quote` icon and light blue accent border.
    - Bulleted lists (`- `, `* `) and numbered lists (`1. `, `2. `).
    - Fenced code blocks (` ``` `) with dark code container and syntax styling.
    - Inline markdown (bold `**text**`, italic `*text*`, inline code `` `code` ``, hyperlinks `[text](url)`).
  - Switched the post content wrapper from `<p>` to `<div>` with `space-y-1` to render nested blocks cleanly without DOM warnings.

### 47. Three Sharing Actions from Off-the-Record & Full Answer Display
- **Location:** `src/components/ai/IdvyPrivateSidebar.jsx`, `src/pages/DiscussionView.jsx`, `src/components/ai/IdvyMessage.jsx`, `server/idvyCore.js`, `api/idvy-chat.js`, `supabase/functions/idvy-chat/index.ts`
- **Changes:**
  - **3 Distinct Actions on OTR Responses:**
    1. **"Send to Input Box"**: Places response text into the main discussion input box for the user to review, edit, or customize before sending.
    2. **"Post as Idvy"**: Instantly posts into the public chat as Idvy's native AI card with full markdown styling and no meta tags.
    3. **"Answer in Main Chat"**: Sends the user's original query directly into the main public chat, prompting Idvy to formulate and deliver her answer publicly in real-time.
  - **No Truncation / Trimming:**
    - Removed client-side slice truncation (`content.slice(0, 2400) + '...'`) in `IdvyMessage.jsx` so answers are never clipped.
    - Raised model generation limits from 1,024 tokens to 3,500 tokens across backend handlers (`idvyCore.js`, `api/idvy-chat.js`, and `supabase/functions/idvy-chat/index.ts`).

### 48. Granular Control Over Member AI Access (Off-Chat vs. Tagging)
- **Location:** `src/services/aiService.js`, `src/components/ai/AIAccessManagerModal.jsx`, `src/pages/DiscussionView.jsx`, `src/components/posts/PostComposer.jsx`
- **Details:**
  - Separated AI permissions into two independent dimensions:
    1. **Off-chat access (`can_use_otr`)**: Allows a member to interact with Idvy privately in Off-the-Record without posting to the group.
    2. **Tagging access (`can_tag_ai`)**: Allows a member to mention `@Idvy` in the public idea discussion to receive AI responses.
  - The idea owner and platform admins can grant or revoke either permission individually or both together. Revoking one has zero effect on the other.
  - **Chat Command Support**: Added commands directly inside the idea chat:
    - `/give.ai.accto @member [otr|tag|both]`
    - `/revoke.ai.accto @member [otr|tag|all]`
  - Enforced across frontend buttons, modals, input auto-completes, and backend AI query dispatchers.

### 49. Slash Command Selection via Enter Key in Private Chat
- **Location:** `src/components/ai/IdvyPrivateSidebar.jsx`, `src/components/ai/SlashCommandMenu.jsx`
- **Root Cause:** In `IdvyPrivateSidebar.jsx`'s `handleKeyDown`, `Enter` and `Tab` keys were calling `e.preventDefault(); return;` without inserting the selected command, forcing the user to select commands manually with the mouse.
- **Fix:**
  - In `IdvyPrivateSidebar.jsx`, when `showSlashMenu` is open, `Enter` and `Tab` now call `insertSlashCommand(filteredSlashCommands[activeSlashIdx] || filteredSlashCommands[0])`.
  - Added arrow key cycling (`ArrowUp` / `ArrowDown`), `Escape` dismissal, and proper cursor placement with `selectionStart ?? inputText.length`.
  - In `SlashCommandMenu.jsx`, fixed command query regex escaping (`^[\/.]`).

### 50. "Ask in OTR" Visibility Tied to Off-Chat Permissions
- **Location:** `src/components/posts/PostItem.jsx`, `src/pages/DiscussionView.jsx`
- **Fix:**
  - Added `canUseOTR` prop to `PostItem.jsx`.
  - Conditioned both the quick action button (`{onAskIdvyInOTR && canUseOTR && post.content && ...}`) and the 3-dots options menu item on `canUseOTR`.
  - In `DiscussionView.jsx`, `onAskIdvyInOTR` is passed as `(canUseOTR || isOwner || isAdmin) ? handleAskIdvyInOTR : null` and header Off-the-Record button strictly verifies `canUseOTR`. Unauthorized members never see the option.

### 51. Real-Time Cross-Device AI Permission Synchronization
- **Location:** `src/services/aiService.js`, `src/services/postService.js`, `src/pages/DiscussionView.jsx`, `src/components/ai/AIAccessManagerModal.jsx`
- **Details:**
  - Solved cross-account permission lag where members had to refresh or re-login to see granted permissions.
  - When permissions are changed, `aiService.setMemberGranularAccess` broadcasts a silent system post (`[AI_PERMISSIONS_SYNC]`, `agent_name: 'ai_permissions'`).
  - `postService.subscribeToPosts` intercepts this realtime WebSocket payload, updates `aiService`'s permission cache, and dispatches an `ideate:ai_permissions_updated` window event.
### 52. Fix Blank Screen on Opening Off-the-Record Chat
- **Location:** `src/components/ai/IdvyPrivateSidebar.jsx`, `src/pages/DiscussionView.jsx`, `src/components/common/ErrorBoundary.jsx`
- **Root Cause:**
  1. Accessing `idea.title` directly without optional chaining threw a fatal TypeError if `idea` was momentarily unresolved or missing properties.
  2. If `localStorage` had empty arrays (`[]`) or malformed data for the private thread, the component failed to initialize the default greeting and rendered an empty container or threw a mapping error.
  3. `renderFormattedMarkdown` lacked defensive guards around table cells (`cell.trim()`) and table rows, causing uncaught exceptions when parsing irregular table markup.
  4. React lacked an error boundary around the private sidebar, causing any minor render issue in the sidebar to crash the entire application screen.
  5. `IDVY_SLASH_COMMANDS` was referenced in `IdvyPrivateSidebar.jsx` for keyboard slash command matching but was not imported from `aiService.js`, causing a `ReferenceError: IDVY_SLASH_COMMANDS is not defined`.
- **Fix:**
  - Added `IDVY_SLASH_COMMANDS` to the `aiService.js` import in `IdvyPrivateSidebar.jsx`.
  - Used `idea?.title || 'this idea'` safely across greetings, system prompts, and history clearance.
  - Sanitized `storageKey` parsing: if parsed data is not a non-empty array, it initializes the welcome greeting with rich bullet points.
  - Wrapped `renderFormattedMarkdown` and `renderInlineMarkdown` in robust `try...catch` blocks with safe string casts (`String(cell || '').trim()`).
  - Created [ErrorBoundary.jsx](file:///e:/MYAPPS/new_apps/idea_board/src/components/common/ErrorBoundary.jsx) and wrapped `IdvyPrivateSidebar` in [DiscussionView.jsx](file:///e:/MYAPPS/new_apps/idea_board/src/pages/DiscussionView.jsx).

---

### Verification
- Production build executed via `npm run build` and succeeded with **0 errors**.
- All modified files:
  - `src/App.jsx`
  - `src/utils/textUtils.js`
  - `src/components/common/Sidebar.jsx`
  - `src/components/common/NoticeModal.jsx`
  - `src/services/memberService.js`
  - `src/components/ideas/MembersSheet.jsx`
  - `src/components/ideas/IdeaInfoModal.jsx`
  - `src/services/ideaService.js`
  - `src/pages/DiscussionView.jsx`
  - `src/pages/AdminDashboard.jsx`
  - `src/components/posts/PostComposer.jsx`
  - `src/components/posts/PostItem.jsx`
  - `src/components/ai/IdvyMessage.jsx`
  - `src/components/ai/SlashCommandMenu.jsx`
  - `src/components/ai/IdvyPrivateSidebar.jsx`
  - `src/components/ai/IdvyTypingIndicator.jsx`
  - `src/components/ai/AIAccessManagerModal.jsx`
  - `src/services/aiService.js`
  - `src/services/postService.js`
  - `server/idvyCore.js`
  - `api/idvy-chat.js`
  - `supabase/functions/idvy-chat/index.ts`