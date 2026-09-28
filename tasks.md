# Tasks

- [x] **Chat interface Edit/Delete menu**:
  - Replaced direct edit and delete action buttons in discussion view with a settings icon dropdown menu.
  - Dropdown menu is only visible to the author of the idea (`isOwner`) and system administrators (`isAdmin`); completely hidden for regular members.
  - Added "Copy Idea ID" option in the dropdown for easy sharing.
  - *Files*: `src/pages/DiscussionView.jsx`

- [x] **Ideas appearing on app load**:
  - Fixed issue where ideas were not appearing when the app was first opened or refreshed without logging out/in.
  - Resolved session race condition where `getCurrentUser()` fell back to unauthenticated local storage before Supabase session initialization, querying ideas unauthenticated against RLS.
  - Added proper session readiness handling in `AuthContext` and authenticated query dispatching in `App.jsx`.
  - *Files*: `src/services/authService.js`, `src/context/AuthContext.jsx`, `src/services/ideaService.js`

- [x] **Invitation accept/reject workflow**:
  - Inviting a collaborator marks them as `pending_invite` instead of immediately activating membership.
  - Invited users receive an interactive notification card in `Notifications` and a pending invite banner on `Dashboard` with "Accept" and "Decline" buttons.
  - Accepting promotes membership to `member` and increments the idea's member count.
  - Rejecting removes the pending record from `idea_members`.
  - Added "Invitation Sent" badge in `MembersSheet.jsx`.
  - *Files*: `src/services/memberService.js`, `src/pages/Notifications.jsx`, `src/pages/Dashboard.jsx`, `src/components/ideas/AddMemberModal.jsx`, `src/components/ideas/MembersSheet.jsx`

- [x] **Join Idea with ID workflow**:
  - Added "Join with ID" button in Header, Sidebar, and Dashboard.
  - Created `JoinIdeaModal` with live preview of the idea's title, description, cover theme, and owner.
  - Validates that the idea exists and that the user is not already the owner or member.
  - Submitting sends a join request notification to the idea owner.
  - Idea owners receive an interactive card in `Notifications` to "Accept Request" (which adds them as `member`) or "Decline".
  - *Files*: `src/components/ideas/JoinIdeaModal.jsx`, `src/services/memberService.js`, `src/pages/Notifications.jsx`, `src/components/common/Header.jsx`, `src/components/common/Sidebar.jsx`, `src/App.jsx`

- [x] **Web Push Notifications & Cross-Device Delivery**:
  - Implemented full Web Push notification architecture with Service Worker (`public/service-worker.js`), badge/icons, and notification click navigation.
  - Fixed mobile browser notification issue where mobile browsers (Android Chrome, iOS PWA) threw `TypeError: Illegal constructor` when invoking `new Notification()`; transitioned to `ServiceWorkerRegistration.showNotification()` with fallbacks, vibrate, badge, and navigation metadata.
  - Added multi-device Web Push server pipeline (`server/webPushServer.js`, `api/register-push.js`, `api/send-push.js`) using `web-push` with VAPID signing, Vite dev-server middleware, and persistent storage.
  - Added automatic background subscription synchronization on app initialization (`syncSubscription`), automatically pairing devices when logged in without requiring manual toggle.
  - Connected `notifyPostCreated` to both real-time Supabase channels, in-app notifications, and push endpoints for discussions.
  - Added `NotificationSettings` UI in `Profile.jsx` and opt-in prompt banner in `Notifications.jsx` with test notification trigger.
  - *Files*: `public/service-worker.js`, `src/services/pushNotifications.js`, `src/services/notificationService.js`, `src/hooks/usePushNotifications.js`, `server/webPushServer.js`, `api/register-push.js`, `api/send-push.js`, `vite.config.js`