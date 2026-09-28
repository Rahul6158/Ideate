-- ==============================================================================
-- Push Notifications & In-App Notification Center Schema
-- ==============================================================================

-- 1. PUSH SUBSCRIPTIONS TABLE
-- Stores multi-device Web Push subscriptions for each user
create table if not exists public.push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  last_used_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on push_subscriptions
alter table public.push_subscriptions enable row level security;

-- Policies for push_subscriptions
-- Users can only view, register, update, and remove their own device subscriptions
create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can register their own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Indexes for push_subscriptions
create index if not exists idx_push_sub_user on public.push_subscriptions(user_id);
create index if not exists idx_push_sub_endpoint on public.push_subscriptions(endpoint);

-- 2. NOTIFICATIONS TABLE
-- Stores in-app notifications and history
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete set null,
  idea_id uuid references public.ideas(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  type text not null default 'new_post',
  title text not null,
  message text,
  body text,
  is_read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on notifications
alter table public.notifications enable row level security;

-- Policies for notifications
create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- Indexes for notifications
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_idea on public.notifications(idea_id);

-- 3. HELPER FUNCTION: GET RECIPIENTS FOR A NEW POST
-- Returns all user IDs who are members or owner of the idea, excluding the post author
create or replace function public.get_post_notification_recipients(p_idea_id uuid, p_author_id uuid)
returns table (recipient_id uuid)
language sql
security definer
stable
as $$
  select distinct u.user_id as recipient_id
  from (
    -- Idea owner
    select owner_id as user_id
    from public.ideas
    where id = p_idea_id and owner_id != p_author_id
    union
    -- Active idea members (excluding pending invites)
    select user_id
    from public.idea_members
    where idea_id = p_idea_id
      and user_id != p_author_id
      and role != 'pending_invite'
  ) u;
$$;
