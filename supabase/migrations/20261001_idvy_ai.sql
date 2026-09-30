-- ==============================================================================
-- Idvy AI Integration Migration: Schema, Tables, Posts Extensions & RLS
-- ==============================================================================

-- 1. Extend posts table with AI fields if not already present
alter table public.posts add column if not exists sender_type text default 'user' check (sender_type in ('user', 'ai', 'system'));
alter table public.posts add column if not exists agent_name text default null;
alter table public.posts add column if not exists ai_metadata jsonb default null;

create index if not exists idx_posts_sender_type on public.posts(sender_type);
create index if not exists idx_posts_agent_name on public.posts(agent_name);

-- 2. IDEA AI MEMORY TABLE
-- Preserves rolling memory, core idea, summary, decisions, action items and open questions
create table if not exists public.idea_ai_memory (
  idea_id uuid references public.ideas(id) on delete cascade primary key,
  core_idea text,
  discussion_summary text,
  member_contributions jsonb default '{}'::jsonb,
  decisions jsonb default '[]'::jsonb,
  open_questions jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  last_processed_message_id uuid,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.idea_ai_memory enable row level security;

drop policy if exists "Members can view idea AI memory" on public.idea_ai_memory;
create policy "Members can view idea AI memory"
  on public.idea_ai_memory for select
  to authenticated
  using (public.user_has_idea_access(idea_id));

drop policy if exists "Members can update idea AI memory" on public.idea_ai_memory;
create policy "Members can update idea AI memory"
  on public.idea_ai_memory for insert
  to authenticated
  with check (public.user_has_idea_access(idea_id));

create policy "Members can edit idea AI memory"
  on public.idea_ai_memory for update
  to authenticated
  using (public.user_has_idea_access(idea_id));

-- 3. IDEA AI ACCESS CONTROL TABLE
-- Controls which members have permission to invoke Idvy AI
create table if not exists public.idea_ai_access (
  id uuid default uuid_generate_v4() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  can_use_ai boolean default true not null,
  is_ai_enabled boolean default true not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique(idea_id, user_id)
);

alter table public.idea_ai_access enable row level security;

drop policy if exists "Users can view AI access within their ideas" on public.idea_ai_access;
create policy "Users can view AI access within their ideas"
  on public.idea_ai_access for select
  to authenticated
  using (public.user_has_idea_access(idea_id));

drop policy if exists "Idea owners can manage AI access" on public.idea_ai_access;
create policy "Idea owners can manage AI access"
  on public.idea_ai_access for all
  to authenticated
  using (
    exists (
      select 1 from public.ideas
      where ideas.id = idea_ai_access.idea_id
      and ideas.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ideas
      where ideas.id = idea_ai_access.idea_id
      and ideas.owner_id = auth.uid()
    )
  );

create index if not exists idx_idea_ai_access_lookup on public.idea_ai_access(idea_id, user_id);

-- 4. Ensure Idvy System Profile exists in profiles table so foreign keys never fail
-- System bot UUID: 00000000-0000-0000-0000-000000001d71
do $$
begin
  if not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000001d71'::uuid) then
    -- Try inserting into profiles if no FK constraint blocks or profiles allows bot
    begin
      insert into public.profiles (id, email, display_name, avatar_url, role)
      values (
        '00000000-0000-0000-0000-000000001d71'::uuid,
        'idvy@ideate.app',
        'Idvy',
        '/avatars/idvy.svg',
        'AI Collaborator'
      );
    exception when others then
      -- If foreign key to auth.users exists on profiles, that's fine; postService can attribute via agent_name & sender_type
      null;
    end;
  end if;
end $$;
