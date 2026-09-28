# Ideate — Push Notifications Implementation Plan

Production implementation

React + Vite + Supabase + Vercel

## 1. Objective

Implement a push notification system for Ideate that alerts users when someone posts a new message in an idea discussion, even when the app is closed or running in the background.

The implementation should:

* Support installed Android and iOS PWAs, plus desktop browsers.

* Notify users about new messages in ideas they belong to.

* Exclude the message sender from notifications.

* Allow users to enable or disable notifications.

* Support multiple devices per account.

* Open the correct idea discussion when a notification is tapped.

* Preserve Ideate's private-by-default access model.

* Use the existing Supabase and Vercel infrastructure.

Recommended approach: Native Web Push API + Service Worker + Supabase Edge Functions + Supabase Database Webhooks. This avoids requiring a native mobile application. The Push API supports messages delivered while the web app is not loaded, provided the browser and device support push and the user has subscribed.

![](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN

+1

## 2. Architecture

User sends a post

React app → Supabase posts table

Supabase Database Webhook

Fires when a new post is inserted

Supabase Edge Function

Finds idea members, checks preferences, sends push

Web Push Service

Delivers an encrypted push event to subscribed devices

Service Worker displays notification

User taps → Ideate opens the relevant discussion

Supabase Database Webhooks run asynchronously after database changes, making them suitable for initiating the notification workflow without holding up the original post insert.

![](https://www.google.com/s2/favicons?domain=https://supabase.com\&sz=32)

Supabase Docs

+1

## 3. Implementation phases

01

Database design

Create two new tables and configure Row Level Security.

Table: `push_subscriptions`

Stores each user's device subscription.

|
Column

|

Type

|

Purpose

|
| --- | --- | --- |
|

`id`

|

UUID

|

Primary key

|
|

`user_id`

|

UUID

|

References `auth.users`

|
|

`endpoint`

|

TEXT

|

Push endpoint

|
|

`p256dh`

|

TEXT

|

Subscription public key

|
|

`auth`

|

TEXT

|

Subscription authentication key

|
|

`device_label`

|

TEXT

|

Optional device name

|
|

`created_at`

|

TIMESTAMPTZ

|

Registration time

|
|

`last_used_at`

|

TIMESTAMPTZ

|

Last successful delivery

|

Requirements:

* Multiple subscriptions per user.

* Unique endpoint constraint.

* Users can read, register, and delete only their own subscriptions.

* Push endpoint and keys must never be exposed publicly.

Table: `notifications`

Stores notification history for the in-app notification center.

|
Column

|

Type

|

Purpose

|
| --- | --- | --- |
|

`id`

|

UUID

|

Notification ID

|
|

`recipient_id`

|

UUID

|

Receiving user

|
|

`actor_id`

|

UUID

|

User who posted

|
|

`idea_id`

|

UUID

|

Related idea

|
|

`post_id`

|

UUID

|

Related post

|
|

`type`

|

TEXT

|

`new_post`

|
|

`title`

|

TEXT

|

Notification title

|
|

`body`

|

TEXT

|

Preview text

|
|

`is_read`

|

BOOLEAN

|

Read status

|
|

`created_at`

|

TIMESTAMPTZ

|

Creation time

|

Add appropriate indexes for recipient, read status, and creation date. Apply RLS so users can view and update only their own notifications.

02

Service Worker and PWA setup

Add a service worker that listens for push events and displays system notifications.

Suggested file:

```
public/
  service-worker.js
  icons/
    notification-icon.png
    notification-badge.png
```

Responsibilities:

* Handle incoming `push` events.

* Parse notification payloads.

* Display notifications using `self.registration.showNotification()`.

* Handle `notificationclick`.

* Open or focus the correct Ideate URL.

* Handle expired or invalid notification payloads gracefully.

The service worker must be registered from the frontend and served from the correct scope. Mobile notifications should use the service worker's notification API rather than relying on the regular page-level `Notification()` constructor.

![](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN

+1

03

Frontend notification subscription

Create a reusable notification service.

Suggested files:

```
src/
  services/
    pushNotifications.js
  hooks/
    usePushNotifications.js
  components/
    NotificationSettings.jsx
```

On the user's explicit action to enable notifications:

1. Check browser support for Service Workers, Notifications, and Push API.

2. Register the service worker.

3. Request notification permission.

4. Subscribe using `PushManager.subscribe()`.

5. Send the subscription to a secure Supabase Edge Function.

6. Save the subscription in `push_subscriptions`.

7. Update the interface to show notifications as enabled.

Use a public VAPID key in the frontend. Keep the VAPID private key exclusively in Supabase secrets.

Important: Permission requests must be triggered by a user gesture, such as tapping an Enable Notifications button.

![](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN

+1

04

Backend notification processing

Create Supabase Edge Functions:

```
supabase/
  functions/
    register-push/
      index.ts
    send-push/
      index.ts
    delete-push/
      index.ts
```

`register-push`

* Verify the authenticated user.

* Validate the incoming subscription.

* Upsert the subscription for that user.

* Prevent one user from registering a subscription on behalf of another.

`send-push`

* Receive the new-post webhook.

* Validate the webhook secret.

* Retrieve the post and associated idea.

* Find authorized idea members.

* Exclude the sender.

* Create in-app notification records.

* Retrieve each recipient's active push subscriptions.

* Send push notifications.

* Record delivery failures and remove expired subscriptions when appropriate.

`delete-push`

* Verify the authenticated user.

* Remove the current device's subscription when notifications are disabled.

Use a Web Push-compatible library in the Edge Function to perform encryption and VAPID authentication. Keep all private keys and service-role credentials on the server. Supabase Edge Functions support server-side TypeScript and secrets through environment variables.

![](https://www.google.com/s2/favicons?domain=https://supabase.com\&sz=32)

Supabase Docs

+1

05

Database webhook integration

In Supabase Dashboard:

1. Navigate to Database → Webhooks.

2. Create a webhook for the `posts` table.

3. Select the `INSERT` event.

4. Configure the webhook to call the `send-push` Edge Function.

5. Configure secure authentication for the webhook.

6. Test with a new post.

The webhook should invoke the function only after a post has been successfully created. Supabase documents the webhook configuration and event payload format.

![](https://www.google.com/s2/favicons?domain=https://supabase.com\&sz=32)

Supabase Docs

+1

Note: The webhook payload should be treated as an event identifier, not trusted as proof that the sender or recipient is authorized. The Edge Function should retrieve the post and verify membership using the database.

06

Notification UI

Add a bell icon to the Ideate header.

## Ideate

3

Notifications

Ananya posted in Product Roadmap

New

There's a new update in your discussion.

2 minutes ago

Rahul posted in AI Assistant

A new contribution was added.

1 hour ago

Mark all as read

View all

Features:

* Unread count badge.

* Notification dropdown or dedicated page.

* Mark as read.

* Mark all as read.

* Navigate to the associated idea and post.

* Notification settings to enable or disable push.

* Per-idea mute settings as a later enhancement.

07

Deployment and configuration

Add the following environment configuration:

|
Variable

|

Location

|
| --- | --- |
|

`VITE_VAPID_PUBLIC_KEY`

|

Vercel frontend

|
|

`VAPID_PUBLIC_KEY`

|

Supabase Edge Function

|
|

`VAPID_PRIVATE_KEY`

|

Supabase Edge Function

|
|

`VAPID_SUBJECT`

|

Supabase Edge Function

|
|

`PUSH_WEBHOOK_SECRET`

|

Supabase Edge Function and webhook

|

Deploy the Edge Functions and database migration, then deploy the frontend to Vercel.

Do not put the VAPID private key, webhook secret, or Supabase service-role key in any `VITE_` variable or client-side file.

## 4. Notification rules

The system should follow these rules to avoid unnecessary notifications and protect privacy.

|
Event

|

Behavior

|
| --- | --- |
|

New post in an idea

|

Notify other members

|
|

User posts their own message

|

Do not notify that user

|
|

User is not an idea member

|

Do not notify

|
|

User has disabled push

|

Store in-app notification only

|
|

User has muted the idea

|

Do not send push for that idea

|
|

User has multiple devices

|

Send to all active subscriptions

|
|

Device subscription expires

|

Remove or deactivate it

|
|

User is viewing the relevant discussion

|

Suppress push where practical

|
|

Duplicate webhook delivery

|

Avoid duplicate notifications

|

For message previews, start with a privacy-preserving notification such as:

> New activity in Ideate Someone posted in Product Roadmap. Tap to view.

This avoids exposing potentially sensitive discussion content on a locked phone. A user preference to show message previews can be added later.

## 5. Testing plan

### Acceptance checklist

Progress

0 / 13

User can enable notifications from Ideate.

Browser permission is requested only after the user taps Enable.

Subscription is saved against the authenticated user.

A new post triggers notifications for authorized recipients.

The sender does not receive a notification for their own post.

Notification arrives when the app is in the background.

Notification arrives when the app is closed, where supported.

Tapping a notification opens the correct idea discussion.

Multiple devices receive notifications.

Disabling notifications removes the device subscription.

Unauthorized users cannot read other users' notification history or subscriptions.

Expired subscriptions and failed deliveries are handled safely.

Existing post creation and Realtime behavior remain unaffected.

Test on real devices, not just desktop emulation. For iOS, install Ideate through Add to Home Screen and grant permission to the installed web app. Web push support on iOS requires iOS 16.4 or later and the Home Screen installation flow.

![](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN

+1

## 6. Suggested implementation order

|
Stage

|

Deliverable

|
| --- | --- |
|

1

|

Database migrations, RLS, and notification schema

|
|

2

|

Service worker and PWA notification support

|
|

3

|

Frontend permission and subscription management

|
|

4

|

Edge Functions for registering and deleting subscriptions

|
|

5

|

Post webhook and push delivery function

|
|

6

|

Notification center and unread badge

|
|

7

|

Notification click-through navigation

|
|

8

|

Device testing, security review, and production deployment

|

Estimated effort: Approximately 2–4 focused development days for an initial production-ready version, assuming the existing post and membership tables are stable. The exact effort depends on the current PWA configuration and the schema of Ideate's existing posts and memberships.

## 7. Definition of done

The feature is complete when a user can install Ideate on their phone, enable notifications, close the app, and receive a push notification when another member posts in an idea they belong to. Tapping the notification should take them directly to that discussion, without exposing private content to unauthorized users.

The implementation should be added as a separate notification module without disrupting existing authentication, post creation, Realtime updates, or idea membership functionality.
