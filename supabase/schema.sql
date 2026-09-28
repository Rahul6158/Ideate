-- ==============================================================================
-- IdeaFlow — Supabase Database Schema & Row Level Security (RLS)
-- Based on idea_implementation.md PRD specifications
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
-- Mirrors supabase auth.users for application metadata
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 2. IDEAS TABLE
create table if not exists public.ideas (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  cover_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on ideas
alter table public.ideas enable row level security;

-- 3. IDEA MEMBERS TABLE
create table if not exists public.idea_members (
  id uuid default uuid_generate_v4() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'member', 'admin')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique(idea_id, user_id)
);

-- Enable RLS on idea_members
alter table public.idea_members enable row level security;

-- 4. POSTS TABLE
create table if not exists public.posts (
  id uuid default uuid_generate_v4() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on posts
alter table public.posts enable row level security;

-- 5. POST ATTACHMENTS TABLE
create table if not exists public.post_attachments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  file_name text not null,
  file_type text not null, -- 'image', 'audio', 'document'
  file_size bigint default 0,
  storage_path text not null,
  duration_seconds integer, -- for audio
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on post_attachments
alter table public.post_attachments enable row level security;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- Helper function to check if user has access to an idea
create or replace function public.user_has_idea_access(lookup_idea_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.ideas where id = lookup_idea_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.idea_members where idea_id = lookup_idea_id and user_id = auth.uid()
  );
$$;

-- IDEAS POLICIES
create policy "Users can view ideas they own or are members of"
  on public.ideas for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.idea_members
      where idea_members.idea_id = ideas.id
      and idea_members.user_id = auth.uid()
    )
  );

create policy "Users can insert their own ideas"
  on public.ideas for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update their own ideas"
  on public.ideas for update
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can delete their own ideas"
  on public.ideas for delete
  to authenticated
  using (auth.uid() = owner_id);

-- IDEA MEMBERS POLICIES
create policy "Members can view membership of ideas they can access"
  on public.idea_members for select
  to authenticated
  using (public.user_has_idea_access(idea_id));

create policy "Idea owners can insert members"
  on public.idea_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.ideas
      where ideas.id = idea_members.idea_id
      and ideas.owner_id = auth.uid()
    )
  );

create policy "Idea owners or member self can delete membership"
  on public.idea_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.ideas
      where ideas.id = idea_members.idea_id
      and ideas.owner_id = auth.uid()
    )
  );

-- POSTS POLICIES
create policy "Users can view posts for ideas they have access to"
  on public.posts for select
  to authenticated
  using (public.user_has_idea_access(idea_id));

create policy "Authorized users can insert posts"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.user_has_idea_access(idea_id)
  );

create policy "Users can update their own posts"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own posts or idea owner can delete"
  on public.posts for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.ideas
      where ideas.id = posts.idea_id
      and ideas.owner_id = auth.uid()
    )
  );

-- POST ATTACHMENTS POLICIES
create policy "Users can view attachments if they have access to the post's idea"
  on public.post_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_attachments.post_id
      and public.user_has_idea_access(posts.idea_id)
    )
  );

create policy "Users can insert attachments to their posts"
  on public.post_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_attachments.post_id
      and posts.user_id = auth.uid()
    )
  );

-- Indexes for maximum performance
create index if not exists idx_ideas_owner on public.ideas(owner_id);
create index if not exists idx_idea_members_idea on public.idea_members(idea_id);
create index if not exists idx_idea_members_user on public.idea_members(user_id);
create index if not exists idx_posts_idea on public.posts(idea_id);
create index if not exists idx_posts_user on public.posts(user_id);
create index if not exists idx_post_attachments_post on public.post_attachments(post_id);

-- Storage bucket setup comment:
-- Run in Supabase SQL Editor or dashboard:
-- insert into storage.buckets (id, name, public) values ('idea-attachments', 'idea-attachments', true);

-- ==============================================================================
-- 6. PUSH SUBSCRIPTIONS & NOTIFICATIONS
-- ==============================================================================

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

alter table public.push_subscriptions enable row level security;

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

create index if not exists idx_push_sub_user on public.push_subscriptions(user_id);
create index if not exists idx_push_sub_endpoint on public.push_subscriptions(endpoint);

-- NOTIFICATIONS TABLE
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

alter table public.notifications enable row level security;

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

create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_idea on public.notifications(idea_id);

-- Helper function to get post notification recipients
create or replace function public.get_post_notification_recipients(p_idea_id uuid, p_author_id uuid)
returns table (recipient_id uuid)
language sql
security definer
stable
as $$
  select distinct u.user_id as recipient_id
  from (
    select owner_id as user_id
    from public.ideas
    where id = p_idea_id and owner_id != p_author_id
    union
    select user_id
    from public.idea_members
    where idea_id = p_idea_id
      and user_id != p_author_id
      and role != 'pending_invite'
  ) u;
$$;

