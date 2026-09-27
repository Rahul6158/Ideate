# Idea Discussion Board

## Product Requirements Document (PRD) + AI Agent Implementation Plan

**Version:** 1.0
**Status:** MVP
**Primary Stack:** React + Vite + Supabase + Vercel
**Product Type:** Private collaborative idea discussion platform

---

# 1. Product Overview

Idea Discussion Board is a private collaborative platform where users can create ideas and invite specific people to participate in discussions around those ideas.

Each idea acts as a private discussion space.

Members can contribute to an idea by posting:

* Text
* Voice recordings
* Images
* Files
* Any combination of the above in a single post

Posts appear chronologically so that the entire evolution of an idea is preserved.

The platform is intentionally simple. It is **not** an SDLC/project-management application, task manager, or complex documentation system.

The core product is:

> **Create an idea → invite people → discuss the idea → capture every contribution as a permanent timeline.**

---

# 2. Problem Statement

Ideas are often discussed informally through conversations, WhatsApp messages, voice notes, screenshots, and scattered documents.

When an idea is discussed by multiple people, useful information becomes difficult to preserve:

* Important suggestions are forgotten.
* Voice discussions are separated from written notes.
* Screenshots and reference images become disconnected from the discussion.
* Different people contribute at different times.
* There is no single chronological record of how an idea evolved.
* Generic chat applications are not specifically organized around an idea.
* Notes applications usually focus on individual documentation rather than collaborative idea discussion.

The product solves this by providing a dedicated private workspace for each idea where authorized members can continuously contribute text, voice, images, and files.

---

# 3. Product Vision

Create a simple place where an idea can live and evolve.

Instead of asking users to structure their thoughts into headings, categories, requirements, or formal documentation, the platform should let them simply post what they want to contribute.

The product should feel like:

> "A private discussion timeline dedicated to one idea."

---

# 4. Target Users

## Primary User

An individual who frequently develops ideas and discusses them with friends, colleagues, clients, or collaborators.

Examples:

* Software developers
* Founders
* Students
* Designers
* Product managers
* Freelancers
* Researchers
* Content creators
* Teams brainstorming new products

## Secondary User

A person invited by the idea owner to contribute to an existing idea.

---

# 5. Core Product Principles

### 5.1 Idea-centric

Everything revolves around an idea.

### 5.2 Private by default

Users cannot automatically see other users' ideas.

### 5.3 Explicit membership

Only the idea owner and explicitly added members can access an idea.

### 5.4 Flexible contribution

Users should not be forced to select a note type.

They can post:

* Text
* Voice
* Image
* File
* Text + Voice
* Text + Image
* Voice + Image
* Text + Voice + Image

### 5.5 Chronological history

The discussion should preserve the order in which contributions were made.

### 5.6 Simple UX

The MVP should avoid unnecessary project-management functionality.

---

# 6. User Flow

## New User

```text
Landing Page
    ↓
Sign Up
    ↓
Create Account
    ↓
Dashboard
    ↓
Create First Idea
```

## Existing User

```text
Login
  ↓
Dashboard
  ↓
My Ideas / Shared With Me
  ↓
Open Idea
  ↓
View Discussion
```

## Idea Owner

```text
Create Idea
    ↓
Add Members
    ↓
Post Content
    ↓
Continue Discussion
```

## Invited Member

```text
Create/Login Account
    ↓
Dashboard
    ↓
Shared With Me
    ↓
Open Idea
    ↓
Post Contribution
```

---

# 7. Functional Requirements

## 7.1 Authentication

Use Supabase Authentication.

### Required features

* Sign up
* Login
* Logout
* Persistent session
* Password-based authentication
* Email-based account identification
* Authentication state management
* Protected application routes

### Optional later

* Google OAuth
* Password reset
* Email verification
* Magic links

For MVP, email/password authentication is sufficient unless Supabase configuration makes email verification mandatory.

---

# 8. User Profile

A basic user profile should exist so that members can be identified inside ideas.

Minimum profile information:

```text
id
email
display_name
avatar_url
created_at
```

Supabase Auth remains the source of authentication identity.

A `profiles` table should contain application-specific user information.

Example:

```text
profiles

id
email
display_name
avatar_url
created_at
updated_at
```

The `id` should correspond to the Supabase Auth user ID.

---

# 9. Ideas

A user can create multiple ideas.

## Idea fields

```text
id
owner_id
title
description
created_at
updated_at
```

### Required functionality

* Create idea
* View idea
* Edit idea title
* Edit idea description
* Delete idea
* View creation date
* View last updated date

### Example

```text
Title:
AI Resume Builder

Description:
A platform that automatically analyzes a job description
and helps create a tailored resume.
```

The description is optional.

---

# 10. Idea Dashboard

The dashboard should contain two main sections.

## My Ideas

Ideas where the current user is the owner.

```text
MY IDEAS

AI Resume Builder
Voice AI Assistant
Startup Idea
```

## Shared With Me

Ideas where the current user has been added as a member.

```text
SHARED WITH ME

AI Healthcare Assistant
College Project
New SaaS Idea
```

Each idea card should show:

* Title
* Short description
* Last activity time
* Number of members
* Number of posts

---

# 11. Idea Members

Every idea has members.

There are two initial roles:

```text
OWNER
MEMBER
```

## Owner permissions

Owner can:

* View idea
* Edit idea
* Delete idea
* Add members
* Remove members
* View all posts
* Create posts
* Delete posts where appropriate

## Member permissions

Member can:

* View idea
* Create posts
* View all posts
* Upload attachments
* Add voice recordings

Members cannot:

* Delete the idea
* Add/remove other members
* Change ownership

---

# 12. Adding Members

The owner should have an:

**Add Member**

button.

Example:

```text
Add Member

Email
[ person@example.com ]

[ Add Member ]
```

For MVP, only users who already have an account should be added.

The application should:

1. Accept an email address.
2. Find the corresponding application user.
3. Confirm that the user exists.
4. Add that user to the idea.
5. Display the member in the member list.

If the user does not exist:

```text
No account found for this email.
Ask the person to create an account first.
```

Invitation-by-email for users who have not registered can be added later.

---

# 13. Idea Discussion Feed

This is the central feature of the application.

An idea should contain a chronological feed of posts.

Example:

```text
AI Resume Builder

Rahul
8:32 PM

I think we should focus on automatic JD analysis.


Arun
8:35 PM

🎙 Voice Message
00:42


Rahul
8:41 PM

[Architecture Image]


Kiran
8:45 PM

This could also work for cover letters.
```

Posts should be sorted chronologically.

Default order:

**Oldest → Newest**

New posts appear at the bottom.

---

# 14. Posts

The platform should use one unified post model.

A post can contain text and/or attachments.

## Post fields

```text
id
idea_id
user_id
content
created_at
updated_at
```

`content` can be nullable.

This is important because a post can contain only a voice recording or only an image.

Examples:

### Text only

```text
content = "We should support PDF uploads."
attachments = none
```

### Voice only

```text
content = null
attachments = voice.webm
```

### Image only

```text
content = null
attachments = architecture.png
```

### Text + image

```text
content = "This is the architecture I was thinking about."
attachments = architecture.png
```

### Text + voice + image

All three can exist within the same post.

---

# 15. Post Composer

The primary interaction should be a simple composer.

Example:

```text
┌─────────────────────────────────────────────┐
│ Write something about this idea...          │
│                                             │
│                                             │
└─────────────────────────────────────────────┘

🎤 Voice    🖼 Image    📎 File       [Post]
```

The user should be able to select one or multiple input types.

---

# 16. Text Posts

Users can:

* Type text
* Edit their own text
* Delete their own post where permitted
* Submit the post

The application should prevent empty posts unless an attachment is present.

Valid:

```text
Text only
```

or:

```text
Attachment only
```

Invalid:

```text
Empty post
```

---

# 17. Voice Notes

Users can record audio directly from the browser.

Required functionality:

* Start recording
* Stop recording
* Preview recording
* Cancel recording
* Attach recording to post
* Upload recording
* Play recording
* Delete recording

Recommended browser API:

```text
MediaRecorder API
```

No external voice recording service is required for MVP.

The audio file should be uploaded to Supabase Storage.

---

# 18. Voice-to-Text

The application should support speech-to-text as an additional capability.

Initial implementation should use the browser's available speech recognition capability where supported.

Workflow:

```text
Click microphone
      ↓
Speak
      ↓
Speech converted to text
      ↓
Text appears in composer
      ↓
User can edit
      ↓
Post
```

Important:

Voice recording and speech-to-text are two separate functions.

### Voice recording

Preserves the actual audio.

### Speech-to-text

Converts speech into editable text.

The user should be able to use either or both.

---

# 19. Images

Users can attach images to posts.

Supported initial formats:

* JPG/JPEG
* PNG
* WEBP

The UI should display image previews before posting.

After posting:

```text
Image
↓
Supabase Storage
↓
Post attachment record
```

Images should be displayed inside the discussion feed.

---

# 20. Files

The architecture should support general file attachments, although the MVP can initially prioritize images and audio.

Potential supported files:

* PDF
* DOCX
* TXT
* Other common document formats

The UI should show a file card instead of trying to render unsupported files.

Example:

```text
📄 requirements.pdf
1.2 MB
[Open]
```

---

# 21. Attachments

Use a generic attachment table.

```text
post_attachments

id
post_id
file_name
file_type
file_size
storage_path
created_at
```

This allows multiple attachments on one post.

Example:

```text
Post
 ├── Text
 ├── voice.webm
 ├── architecture.png
 └── requirements.pdf
```

---

# 22. Supabase Storage

Create storage buckets according to the application's needs.

Recommended initial structure:

```text
idea-attachments
```

Within storage paths:

```text
idea-attachments/
    {user_id}/
        {idea_id}/
            {post_id}/
                audio/
                images/
                files/
```

Do not expose raw storage paths directly where signed URLs or authenticated access is more appropriate.

Storage access must follow the same ownership/membership model as the database.

---

# 23. Privacy and Authorization

This is a critical requirement.

A user must NOT be able to access an idea simply because they know its ID.

Access must be controlled using Supabase Row Level Security.

Conceptually:

```text
User requests Idea
        ↓
Is user the owner?
        ↓
YES → Allow

NO
 ↓
Is user in idea_members?
 ↓
YES → Allow

NO → Deny
```

The same authorization principle must apply to:

* Ideas
* Idea members
* Posts
* Attachments
* Storage files

Do not depend on React/frontend checks for security.

RLS must enforce access at the database level.

---

# 24. Database Schema

## profiles

```sql
id uuid primary key
email text
display_name text
avatar_url text
created_at timestamptz
updated_at timestamptz
```

## ideas

```sql
id uuid primary key
owner_id uuid references profiles(id)
title text not null
description text
created_at timestamptz
updated_at timestamptz
```

## idea_members

```sql
id uuid primary key
idea_id uuid references ideas(id) on delete cascade
user_id uuid references profiles(id) on delete cascade
role text not null default 'member'
created_at timestamptz
```

Recommended constraint:

```text
unique(idea_id, user_id)
```

The owner should not need to be duplicated as a normal member unless the implementation chooses to do so.

## posts

```sql
id uuid primary key
idea_id uuid references ideas(id) on delete cascade
user_id uuid references profiles(id)
content text
created_at timestamptz
updated_at timestamptz
```

## post_attachments

```sql
id uuid primary key
post_id uuid references posts(id) on delete cascade
file_name text
file_type text
file_size bigint
storage_path text
created_at timestamptz
```

---

# 25. RLS Requirements

Enable RLS on all application tables.

## Ideas

User can SELECT an idea when:

```text
owner_id = auth.uid()
OR
auth.uid() exists in idea_members
```

Owner can UPDATE/DELETE their own ideas.

## Idea Members

User can SELECT membership information for ideas they can access.

Owner can INSERT/DELETE members.

## Posts

User can SELECT posts if they can access the associated idea.

User can INSERT a post if they are an authorized member/owner of the idea.

User can UPDATE/DELETE their own posts according to the application's permission rules.

## Attachments

User can access an attachment if they can access the associated post/idea.

---

# 26. Realtime Updates

Realtime is useful but should not complicate the initial implementation.

Preferred behavior:

If Rahul and Arun are both viewing the same idea:

```text
Rahul posts
     ↓
Supabase
     ↓
Arun's page receives update
     ↓
New post appears automatically
```

Use Supabase Realtime for posts.

If Realtime causes unnecessary complexity during initial development, implement normal database fetching first and add Realtime as the next milestone.

---

# 27. Main Application Screens

## 27.1 Landing Page

Contains:

* Product name
* Short explanation
* Login
* Sign up

Keep it minimal.

---

## 27.2 Login

```text
Email
Password

[ Login ]

Don't have an account?
Sign Up
```

---

## 27.3 Sign Up

```text
Name
Email
Password
Confirm Password

[ Create Account ]
```

---

## 27.4 Dashboard

```text
Idea Board

+ New Idea

MY IDEAS

[ Idea Card ]
[ Idea Card ]

SHARED WITH ME

[ Idea Card ]
[ Idea Card ]
```

---

# 28. Idea Page

This is the primary application screen.

Recommended structure:

```text
┌────────────────────────────────────────────────────────────┐
│ ← Back                                                     │
│                                                            │
│ AI Resume Builder                          👥 Members       │
│ A platform for...                                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Rahul                                                     │
│ I think we should focus on JD analysis first.             │
│ 8:32 PM                                                   │
│                                                            │
│ Arun                                                      │
│ 🎙 ─────────────── 00:42                                  │
│ 8:35 PM                                                   │
│                                                            │
│ Rahul                                                     │
│ [architecture.png]                                       │
│ 8:41 PM                                                   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Write something...                                         │
│                                                            │
│ 🎤   🖼   📎                                  [Post]       │
└────────────────────────────────────────────────────────────┘
```

---

# 29. Member Management UI

Clicking the member button opens:

```text
Members

Rahul
Owner

Arun
Member

Kiran
Member

+ Add Member
```

Owner can remove members.

A confirmation should appear before removing a member.

---

# 30. Empty States

Dashboard with no ideas:

```text
You don't have any ideas yet.

Create your first idea.

[ + Create Idea ]
```

Idea with no posts:

```text
Nothing here yet.

Start the discussion by sharing your first thought.

[ Write something... ]
```

No shared ideas:

```text
No one has shared an idea with you yet.
```

---

# 31. Error Handling

The application should gracefully handle:

### Authentication errors

```text
Invalid email or password.
```

### Member errors

```text
User not found.
```

### Upload errors

```text
Upload failed. Please try again.
```

### Recording errors

```text
Microphone permission is required to record audio.
```

### Network errors

```text
Something went wrong. Please try again.
```

### Authorization errors

If a user attempts to access an unauthorized idea:

```text
You don't have access to this idea.
```

Do not expose private information about the idea.

---

# 32. Loading States

Every asynchronous operation should have a loading state.

Examples:

```text
Creating idea...
Uploading...
Posting...
Loading discussion...
Adding member...
Removing member...
```

Avoid freezing the UI without feedback.

---

# 33. Optimistic UI

For normal text posts, the application may optimistically display the post while the request is being processed.

For file uploads, show upload progress.

Example:

```text
Uploading image
██████████████░░░░ 72%
```

---

# 34. Validation

## Idea

Title:

* Required
* Reasonable maximum length
* Trim whitespace

Description:

* Optional

## Post

Require at least one:

```text
content
OR
attachment
```

## Member

Email:

* Required
* Valid email format
* User must exist
* User cannot already be a member
* Owner cannot add themselves as a member

---

# 35. Security Requirements

The AI implementation agent must prioritize security.

Never:

* Store passwords manually.
* Put Supabase service-role keys in frontend code.
* Trust frontend authorization checks.
* Expose private storage files publicly unless intentionally configured.
* Allow users to query arbitrary ideas.
* Allow members to modify ownership.
* Allow users to add themselves to arbitrary ideas.

Use:

```text
Supabase anon/publishable key
+
Supabase Auth
+
RLS
+
Storage policies
```

The service-role key must never be included in the Vite frontend.

---

# 36. Frontend Architecture

Recommended structure:

```text
src/
│
├── components/
│   ├── auth/
│   ├── ideas/
│   ├── posts/
│   ├── members/
│   ├── attachments/
│   └── common/
│
├── pages/
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx
│   └── Idea.jsx
│
├── hooks/
│   ├── useAuth.js
│   ├── useIdeas.js
│   ├── usePosts.js
│   └── useMembers.js
│
├── lib/
│   ├── supabase.js
│   └── storage.js
│
├── services/
│   ├── authService.js
│   ├── ideaService.js
│   ├── postService.js
│   └── memberService.js
│
├── routes/
│   └── ProtectedRoute.jsx
│
├── App.jsx
└── main.jsx
```

The exact structure can be adjusted if the existing project uses another architecture.

---

# 37. Recommended Frontend Stack

Use:

```text
React
Vite
JavaScript or TypeScript
Supabase JS
React Router
Tailwind CSS
```

TypeScript is preferred if starting from scratch because the application has several related entities.

If the coding agent is significantly faster in JavaScript, JavaScript is acceptable.

---

# 38. State Management

Do not introduce Redux unless necessary.

For MVP:

* React state
* React Context where appropriate
* Supabase queries
* Custom hooks

should be sufficient.

Authentication state can be managed with an Auth Context or equivalent.

---

# 39. File Upload Strategy

Before upload:

1. Validate file type.
2. Validate file size.
3. Generate a unique storage path.
4. Upload to Supabase Storage.
5. Create attachment database record.
6. Associate attachment with post.
7. Display attachment.

If database insertion fails after upload, the implementation should clean up the orphaned storage file where possible.

---

# 40. Voice Recording Strategy

Use:

```text
MediaRecorder API
```

Workflow:

```text
Start
 ↓
MediaRecorder
 ↓
Audio chunks
 ↓
Stop
 ↓
Blob
 ↓
Preview
 ↓
Upload to Supabase Storage
 ↓
Create attachment record
```

Prefer a browser-compatible audio format.

The implementation should detect unsupported recording environments and provide a clear message.

---

# 41. Voice-to-Text Strategy

Implement voice-to-text separately from audio recording.

Preferred MVP approach:

```text
Browser Speech Recognition
```

If unsupported:

```text
Speech-to-text isn't supported in this browser.
```

Do not introduce a paid transcription API in the first version.

A server/API-based transcription system can be introduced later.

---

# 42. Responsive Design

The application must work on:

* Desktop
* Tablet
* Mobile

On mobile:

```text
Dashboard
   ↓
Idea
   ↓
Discussion feed
   ↓
Composer
```

The post composer should remain easy to access.

Voice recording should be particularly usable on mobile.

---

# 43. UX Requirements

The application should feel:

* Clean
* Fast
* Minimal
* Modern
* Private
* Collaborative

Avoid excessive dashboards, charts, project-management controls, or complicated navigation.

The primary action should always be obvious:

**Post something to the idea.**

---

# 44. Suggested Navigation

Desktop:

```text
┌─────────────────────────────────────────┐
│ Idea Board                     Profile  │
├─────────────┬───────────────────────────┤
│ My Ideas    │                           │
│             │ Current Page              │
│ Shared      │                           │
│ With Me     │                           │
└─────────────┴───────────────────────────┘
```

Mobile:

Use a simple top navigation rather than a permanent sidebar.

---

# 45. MVP Scope

The first production-ready version MUST include:

### Authentication

* Sign up
* Login
* Logout
* Protected routes

### Ideas

* Create
* View
* Edit
* Delete

### Membership

* Add existing user by email
* Remove member
* Display members
* Owner/member permissions

### Discussion

* Chronological posts
* Text posts
* Voice posts
* Image posts
* Mixed posts

### Storage

* Audio uploads
* Image uploads
* File metadata

### Voice

* Browser recording
* Audio playback
* Basic speech-to-text where supported

### Security

* RLS
* Storage policies
* Private ideas
* Private attachments

### Deployment

* Vercel
* Supabase

---

# 46. Explicitly Out of Scope for MVP

Do NOT implement these unless specifically requested later:

* SDLC phases
* Requirements management
* Project management
* Tasks
* Kanban boards
* AI summarization
* AI idea generation
* AI recommendations
* Automatic transcription APIs
* Comments on individual posts
* Post reactions
* Likes
* Threaded replies
* Notifications
* Email invitation system
* Public ideas
* Public profiles
* Search across all users
* Teams/workspaces
* Paid subscriptions
* Billing
* Advanced analytics
* GitHub integration
* Calendar integration

The purpose is to keep the first release focused.

---

# 47. Future Features

Potential future versions can add:

## AI

* Summarize discussion
* Extract decisions
* Extract action items
* Summarize voice recordings
* Search discussion semantically
* Ask questions about an idea
* Identify repeated suggestions

## Collaboration

* Real-time presence
* Notifications
* Replies
* Reactions
* Mentions
* Invitations

## Organization

* Tags
* Search
* Folders
* Favorites
* Archive
* Idea status

## Export

* PDF
* Markdown
* DOCX
* Discussion transcript

These should not be implemented in MVP.

---

# 48. Implementation Plan for AI Coding Agent

The AI agent should implement the application incrementally.

Do not attempt to implement the entire system in one step.

---

## Phase 1 — Project Setup

Tasks:

1. Create React + Vite project.
2. Configure Tailwind CSS.
3. Install Supabase JS.
4. Configure React Router.
5. Create `.env` configuration.
6. Create Supabase client.
7. Create base application layout.
8. Create basic error/loading components.

Environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never expose a Supabase service-role key.

### Completion criteria

* Application starts locally.
* Vite build succeeds.
* Supabase client initializes.
* Environment variables work.
* Vercel-compatible production build works.

---

# Phase 2 — Supabase Authentication

Tasks:

1. Configure Supabase Auth.
2. Create signup page.
3. Create login page.
4. Implement logout.
5. Implement session persistence.
6. Create AuthContext/useAuth.
7. Create protected routes.
8. Redirect unauthenticated users to login.
9. Redirect authenticated users to dashboard.
10. Create profiles table and profile creation logic.

### Completion criteria

A user can:

```text
Sign Up
 ↓
Login
 ↓
Dashboard
 ↓
Refresh browser
 ↓
Remain logged in
 ↓
Logout
```

---

# Phase 3 — Database Schema

Create:

```text
profiles
ideas
idea_members
posts
post_attachments
```

Add:

* Primary keys
* Foreign keys
* Cascading deletes where appropriate
* Timestamps
* Unique constraints

Create indexes on:

```text
ideas.owner_id
idea_members.idea_id
idea_members.user_id
posts.idea_id
posts.user_id
post_attachments.post_id
```

---

# Phase 4 — Row Level Security

This phase is mandatory before production use.

Implement RLS policies for every table.

Test:

### User A

Can access:

```text
Own Idea
Shared Idea
```

Cannot access:

```text
User B's private idea
```

### User B

Can access:

```text
Own Idea
Shared Idea
```

Cannot access:

```text
User A's unrelated idea
```

Attempt unauthorized access directly through Supabase queries and verify that the database denies it.

---

# Phase 5 — Idea CRUD

Implement:

* Create idea
* Read ideas
* Read single idea
* Update idea
* Delete idea

Dashboard sections:

```text
My Ideas
Shared With Me
```

Add loading, empty, and error states.

---

# Phase 6 — Member Management

Implement:

1. Member list.
2. Search user by email.
3. Add member.
4. Prevent duplicate members.
5. Prevent adding nonexistent users.
6. Remove member.
7. Owner-only member management.
8. Member count.

Test authorization thoroughly.

---

# Phase 7 — Text Discussion

Implement:

1. Idea discussion feed.
2. Text composer.
3. Create post.
4. Display post.
5. Display author.
6. Display timestamp.
7. Edit own post.
8. Delete own post.
9. Empty discussion state.
10. Auto-scroll/new-post behavior where appropriate.

The first fully working vertical slice should be:

```text
Login
 ↓
Create Idea
 ↓
Open Idea
 ↓
Post Text
 ↓
See Post
```

---

# Phase 8 — Image Upload

Implement:

1. Image picker.
2. Client-side validation.
3. Preview.
4. Supabase Storage upload.
5. Attachment record creation.
6. Image display.
7. Delete attachment when deleting a post.
8. Storage security policies.

Test:

```text
Image only
Text + image
Multiple images
Invalid file
Large file
```

---

# Phase 9 — Voice Recording

Implement:

1. Microphone permission request.
2. Recording state.
3. Recording timer.
4. Start/stop.
5. Cancel.
6. Audio preview.
7. Upload.
8. Storage record.
9. Audio player in feed.

Test on supported desktop and mobile browsers.

---

# Phase 10 — Voice-to-Text

Implement:

1. Detect browser speech-recognition support.
2. Start listening.
3. Display interim transcription where supported.
4. Insert final text into composer.
5. Allow editing.
6. Stop/cancel recording.
7. Handle permission errors.
8. Handle unsupported browsers.

Do not make speech recognition mandatory for posting.

---

# Phase 11 — Mixed Posts

Verify that the same post can contain:

```text
Text
+
Image
+
Voice
```

Example:

```text
content:
"I think this architecture makes sense."

attachments:
architecture.png
voice-note.webm
```

The UI should render all components in a single post.

---

# Phase 12 — Realtime

After normal posting works:

1. Subscribe to post changes for the current idea.
2. Insert new posts automatically.
3. Handle updates.
4. Handle deletes.
5. Prevent duplicate posts.
6. Clean up subscriptions when leaving the idea page.

Test with two browser sessions:

```text
Browser A → Rahul
Browser B → Arun

Rahul posts
     ↓
Arun sees it without refreshing
```

---

# Phase 13 — UI/UX Polish

Implement:

* Responsive layout
* Mobile composer
* Better loading states
* Skeleton loaders
* Empty states
* Toast notifications
* Confirmation dialogs
* Upload progress
* Recording animation
* Error states
* Accessible buttons
* Keyboard navigation
* Proper focus management

---

# Phase 14 — Security Audit

Before deployment, verify:

### Authentication

* No credentials exposed.
* No service-role key in frontend.
* Protected routes work.

### Database

* RLS enabled everywhere.
* Unauthorized idea access blocked.
* Unauthorized post access blocked.
* Only owners can manage members.

### Storage

* Private files cannot be accessed by unrelated users.
* Storage policies match idea membership.
* Deleted attachments are cleaned up.

### Input

* User input is safely rendered.
* No unsafe HTML injection.
* File type validation exists.
* File size validation exists.

---

# Phase 15 — Production Deployment

Deploy frontend to Vercel.

Configure:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Configure Supabase production authentication settings.

Test:

```text
Production signup
Production login
Production idea creation
Production member addition
Production posting
Production image upload
Production voice upload
Production access control
```

---

# 49. AI Agent Development Rules

The coding agent should follow these rules throughout implementation.

### Rule 1 — Do not over-engineer

Do not introduce:

* Backend server
* Redux
* Microservices
* Redis
* Docker
* Separate API server

unless a later requirement genuinely requires them.

### Rule 2 — Security before UI shortcuts

Never implement authorization only on the frontend.

Supabase RLS is mandatory.

### Rule 3 — Build vertically

Complete working flows before adding additional features.

Preferred order:

```text
Auth
 ↓
Ideas
 ↓
Text Posts
 ↓
Members
 ↓
Images
 ↓
Voice
 ↓
Speech-to-text
 ↓
Realtime
 ↓
Polish
```

### Rule 4 — Keep database relationships clean

Posts belong to ideas.

Attachments belong to posts.

Members belong to ideas.

Users belong to profiles.

### Rule 5 — Don't duplicate storage metadata

The actual file belongs in Supabase Storage.

The database stores metadata and the storage path.

### Rule 6 — Handle failures

Every asynchronous operation must have:

```text
loading
success
error
```

states.

### Rule 7 — Preserve user data

Deleting an idea should intentionally cascade through:

```text
Idea
 ↓
Posts
 ↓
Attachments metadata
```

and the implementation should also clean up associated storage objects.

---

# 50. Definition of Done

The MVP is considered complete when a new user can perform this entire flow:

```text
1. Open application
       ↓
2. Create account
       ↓
3. Login
       ↓
4. Create an idea
       ↓
5. Open the idea
       ↓
6. Write a text post
       ↓
7. Upload an image
       ↓
8. Record a voice note
       ↓
9. Post text + image + voice together
       ↓
10. Add another registered user
       ↓
11. Other user logs in
       ↓
12. Other user sees the shared idea
       ↓
13. Other user posts something
       ↓
14. Original owner sees the new post
       ↓
15. Both users see the chronological discussion
       ↓
16. Users cannot see unrelated private ideas
       ↓
17. Unauthorized users cannot access private data
```

If all of the above works, the MVP is functionally complete.

---

# 51. Final Product Model

The final conceptual model should remain extremely simple:

```text
                         USER
                           │
                    ┌──────┴──────┐
                    │             │
                 OWNERSHIP     MEMBERSHIP
                    │             │
                    └──────┬──────┘
                           ▼
                         IDEA
                           │
                           ▼
                    DISCUSSION FEED
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
          TEXT           VOICE          IMAGE
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                         POST
                           │
                           ▼
                      ATTACHMENTS
```

The product's fundamental interaction is:

> **An idea is a private space where authorized people continuously contribute thoughts using text, voice, images, and files.**

Everything else in the MVP should support that interaction and nothing more.
