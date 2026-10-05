-- Before I Do Content Studio — initial schema
-- Access model: everything belongs to a workspace. A user sees a row only if they are a
-- member of its workspace. Membership is granted only through an invite (or by an admin),
-- so a stranger who signs up sees nothing.

create extension if not exists pgcrypto;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workspaces, users, membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- design tokens (colors, fonts, sizes, safe areas, logo path) editable in Settings
  design_settings jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "users": public profile for each auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- how the generator may refer to this person, e.g. 'founder', 'partner'
  person_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'editor' check (role in ('owner', 'editor')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
create index workspace_invites_email_idx on public.workspace_invites (email) where accepted_at is null;
create index workspace_invites_invited_by_idx on public.workspace_invites (invited_by);

-- Membership check used by every policy. SECURITY DEFINER so it can read
-- workspace_members without recursing through that table's own RLS. It only ever
-- answers for the calling user (auth.uid()).
create or replace function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- Storage paths are '{workspace_id}/...'. Safe text → uuid membership check.
create or replace function private.is_member_of_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.is_member(first_segment::uuid);
end;
$$;

revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.is_owner(uuid) from public, anon;
revoke all on function private.is_member_of_path(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.is_member_of_path(text) to authenticated;

-- New auth user → profile + accept any pending invite for that email.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, new.id, i.role
  from public.workspace_invites i
  where i.email = lower(new.email) and i.accepted_at is null
  on conflict do nothing;

  update public.workspace_invites
  set accepted_at = now()
  where email = lower(new.email) and accepted_at is null;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Brand structure
-- ---------------------------------------------------------------------------

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  -- feeds the 70 / 20 / 10 guardrail
  ratio_group text not null check (ratio_group in ('audience', 'natural_product', 'direct_product')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create table public.brand_brain_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  section text not null check (section in (
    'who_we_are', 'audience', 'product', 'founder_story', 'tone', 'good_examples',
    'bad_examples', 'words_we_use', 'words_we_avoid', 'recurring_topics',
    'visual_principles', 'product_facts', 'faqs', 'audience_language', 'successful_content',
    'permanent_rules', 'personal_context'
  )),
  title text,
  body text not null,
  -- extra structure, e.g. {"avoid": "..."} for paired principles imported from the sheet
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index brand_brain_entries_ws_section_idx on public.brand_brain_entries (workspace_id, section) where deleted_at is null;
create index brand_brain_entries_created_by_idx on public.brand_brain_entries (created_by);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  family text not null check (family in (
    'text_message', 'real_photo', 'notes', 'conversation', 'question', 'product_in_life', 'carousel_editorial'
  )),
  name text not null,
  formats text[] not null default '{story,carousel}',
  best_use text,
  -- layout/style overrides on top of the family renderer
  config jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  usage_count int not null default 0,
  last_used_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_ws_idx on public.templates (workspace_id) where archived_at is null;

create table public.template_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index template_variants_template_id_idx on public.template_variants (template_id);
create index template_variants_ws_idx on public.template_variants (workspace_id);

-- ---------------------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------------------

create table public.gallery_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  preview_path text,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text,
  original_filename text,
  width int,
  height int,
  duration_seconds numeric,
  byte_size bigint,
  orientation text check (orientation in ('portrait', 'landscape', 'square')),
  taken_at timestamptz,
  people text[] not null default '{}',
  location_category text,
  mood text,
  suitable_formats text[] not null default '{}',
  notes text,
  worked_well boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index gallery_assets_ws_created_idx on public.gallery_assets (workspace_id, created_at desc) where deleted_at is null;
create index gallery_assets_created_by_idx on public.gallery_assets (created_by);

create table public.gallery_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  kind text not null default 'subject' check (kind in ('people', 'place', 'subject', 'format', 'mood', 'other')),
  is_suggested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.asset_tags (
  asset_id uuid not null references public.gallery_assets (id) on delete cascade,
  tag_id uuid not null references public.gallery_tags (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  primary key (asset_id, tag_id)
);
create index asset_tags_tag_id_idx on public.asset_tags (tag_id);
create index asset_tags_ws_idx on public.asset_tags (workspace_id);

-- ---------------------------------------------------------------------------
-- Ideas & audience language
-- ---------------------------------------------------------------------------

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  body text not null default '',
  kind text not null default 'text' check (kind in ('text', 'photo', 'screenshot', 'voice')),
  asset_id uuid references public.gallery_assets (id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'inbox' check (status in ('inbox', 'developed', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index ideas_ws_created_idx on public.ideas (workspace_id, created_at desc) where deleted_at is null;
create index ideas_asset_id_idx on public.ideas (asset_id);
create index ideas_created_by_idx on public.ideas (created_by);

create table public.audience_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  original_text text not null,
  source_type text not null check (source_type in (
    'story_reply', 'dm', 'comment', 'question', 'situation', 'quote', 'objection'
  )),
  topic text,
  received_on date,
  permission_status text not null default 'not_needed' check (permission_status in (
    'not_needed', 'pending', 'granted', 'denied'
  )),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index audience_entries_ws_created_idx on public.audience_entries (workspace_id, created_at desc) where deleted_at is null;
create index audience_entries_created_by_idx on public.audience_entries (created_by);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  format text not null check (format in (
    'story', 'story_sequence', 'carousel', 'pov_reel', 'talking_reel', 'reel', 'post', 'question', 'poll'
  )),
  pillar_id uuid references public.content_pillars (id) on delete set null,
  status text not null default 'idea' check (status in (
    'idea', 'writing', 'ready_to_film', 'filmed', 'editing', 'ready', 'scheduled', 'published'
  )),
  topic text,
  hook text,
  -- Format-specific structure, validated in the app with zod:
  --   story/story_sequence → { frames: StoryFrame[] }
  --   carousel             → { slides: CarouselSlide[] }
  --   pov_reel/reels       → { pov: {...shot, length, location, props, sound} }
  body jsonb not null default '{}'::jsonb,
  caption text,
  cta text,
  supporting_story text,
  visual_notes text,
  notes text,
  requires_filming boolean not null default false,
  requires_product boolean not null default false,
  requires_barak boolean not null default false,
  requires_couple boolean not null default false,
  product_presence text not null default 'none' check (product_presence in ('none', 'natural', 'direct')),
  prep_minutes int check (prep_minutes is null or prep_minutes between 0 and 600),
  location_category text,
  topic_tags text[] not null default '{}',
  template_id uuid references public.templates (id) on delete set null,
  sounds_like_us int check (sounds_like_us is null or sounds_like_us between 1 and 100),
  score_breakdown jsonb,
  source text not null default 'manual' check (source in ('manual', 'import', 'generated', 'idea', 'audience')),
  source_ref text,
  idea_id uuid references public.ideas (id) on delete set null,
  audience_entry_id uuid references public.audience_entries (id) on delete set null,
  -- a Story that supports a main piece (e.g. the daily Story for a POV day)
  parent_id uuid references public.content_items (id) on delete set null,
  is_quick boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index content_items_ws_status_idx on public.content_items (workspace_id, status) where deleted_at is null;
create index content_items_ws_published_idx on public.content_items (workspace_id, published_at desc) where published_at is not null;
create index content_items_pillar_id_idx on public.content_items (pillar_id);
create index content_items_template_id_idx on public.content_items (template_id);
create index content_items_idea_id_idx on public.content_items (idea_id);
create index content_items_audience_entry_id_idx on public.content_items (audience_entry_id);
create index content_items_parent_id_idx on public.content_items (parent_id);
create index content_items_created_by_idx on public.content_items (created_by);
create unique index content_items_ws_source_ref_idx on public.content_items (workspace_id, source_ref) where source_ref is not null;

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content_items (id) on delete cascade,
  snapshot jsonb not null,
  reason text not null default 'autosave' check (reason in ('autosave', 'manual', 'generation', 'restore', 'import')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_versions_content_created_idx on public.content_versions (content_id, created_at desc);
create index content_versions_ws_idx on public.content_versions (workspace_id);
create index content_versions_created_by_idx on public.content_versions (created_by);

create table public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null unique references public.content_items (id) on delete cascade,
  scheduled_on date not null,
  scheduled_time time,
  plan_day int check (plan_day is null or plan_day between 1 and 366),
  slot text not null default 'main' check (slot in ('main', 'story', 'extra')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_calendar_ws_date_idx on public.content_calendar (workspace_id, scheduled_on);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content_items (id) on delete cascade,
  asset_id uuid not null references public.gallery_assets (id) on delete cascade,
  -- 'primary' or the frame/slide key the asset is placed on
  role text not null default 'primary',
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (content_id, asset_id, role)
);
create index content_assets_asset_id_idx on public.content_assets (asset_id);
create index content_assets_ws_idx on public.content_assets (workspace_id);

create table public.generation_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid references public.content_items (id) on delete set null,
  task text not null check (task in (
    'story', 'story_sequence', 'carousel', 'pov', 'post', 'caption', 'question', 'poll',
    'evaluate', 'rewrite', 'audience_transform', 'asset_recommendation', 'directions'
  )),
  provider text not null,
  model text,
  input jsonb not null default '{}'::jsonb,
  -- what context was sent (ids and counts, not raw private data)
  context_summary jsonb not null default '{}'::jsonb,
  output jsonb,
  score int,
  status text not null default 'ok' check (status in ('ok', 'error', 'fallback')),
  error text,
  latency_ms int,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index generation_history_ws_created_idx on public.generation_history (workspace_id, created_at desc);
create index generation_history_content_id_idx on public.generation_history (content_id);
create index generation_history_created_by_idx on public.generation_history (created_by);

create table public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid references public.content_items (id) on delete set null,
  generation_id uuid references public.generation_history (id) on delete set null,
  kind text not null check (kind in (
    'more_personal', 'less_promotional', 'funnier', 'sharper', 'more_natural', 'this_is_us', 'not_us', 'other_direction'
  )),
  text_snapshot text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_feedback_ws_created_idx on public.content_feedback (workspace_id, created_at desc);
create index content_feedback_content_id_idx on public.content_feedback (content_id);
create index content_feedback_generation_id_idx on public.content_feedback (generation_id);
create index content_feedback_created_by_idx on public.content_feedback (created_by);

create table public.analytics_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content_items (id) on delete cascade,
  recorded_on date not null default current_date,
  views int check (views >= 0),
  reach int check (reach >= 0),
  likes int check (likes >= 0),
  comments int check (comments >= 0),
  shares int check (shares >= 0),
  saves int check (saves >= 0),
  story_replies int check (story_replies >= 0),
  poll_responses int check (poll_responses >= 0),
  profile_visits int check (profile_visits >= 0),
  link_clicks int check (link_clicks >= 0),
  sales int check (sales >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, recorded_on)
);
create index analytics_entries_ws_idx on public.analytics_entries (workspace_id, recorded_on desc);

create table public.highlight_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  title text not null,
  purpose text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create table public.highlight_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  collection_id uuid not null references public.highlight_collections (id) on delete cascade,
  position int not null default 0,
  body text not null,
  visual_notes text,
  interaction text,
  content_id uuid references public.content_items (id) on delete set null,
  asset_id uuid references public.gallery_assets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index highlight_items_collection_idx on public.highlight_items (collection_id, position);
create index highlight_items_ws_idx on public.highlight_items (workspace_id);
create index highlight_items_content_id_idx on public.highlight_items (content_id);
create index highlight_items_asset_id_idx on public.highlight_items (asset_id);

-- Batch filming ("יום צילום")
create table public.filming_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  minutes int not null check (minutes between 5 and 480),
  available text[] not null default '{}',
  plan jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index filming_sessions_ws_idx on public.filming_sessions (workspace_id, created_at desc);
create index filming_sessions_created_by_idx on public.filming_sessions (created_by);

create table public.filming_session_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  session_id uuid not null references public.filming_sessions (id) on delete cascade,
  content_id uuid not null references public.content_items (id) on delete cascade,
  look_number int not null default 1,
  position int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, content_id)
);
create index filming_session_items_content_id_idx on public.filming_session_items (content_id);
create index filming_session_items_ws_idx on public.filming_session_items (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'workspaces', 'profiles', 'content_pillars', 'brand_brain_entries', 'templates', 'template_variants',
    'gallery_assets', 'gallery_tags', 'ideas', 'audience_entries', 'content_items', 'content_calendar',
    'analytics_entries', 'highlight_collections', 'highlight_items', 'filming_sessions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

create policy workspaces_select on public.workspaces for select to authenticated
  using ((select private.is_member(id)));
create policy workspaces_update on public.workspaces for update to authenticated
  using ((select private.is_member(id))) with check ((select private.is_member(id)));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy members_select on public.workspace_members for select to authenticated
  using ((select private.is_member(workspace_id)));

create policy invites_select on public.workspace_invites for select to authenticated
  using ((select private.is_owner(workspace_id)));
create policy invites_insert on public.workspace_invites for insert to authenticated
  with check ((select private.is_owner(workspace_id)));
create policy invites_delete on public.workspace_invites for delete to authenticated
  using ((select private.is_owner(workspace_id)));

-- Every workspace-scoped table: members have full access to their workspace's rows.
do $$
declare t text;
begin
  foreach t in array array[
    'content_pillars', 'brand_brain_entries', 'templates', 'template_variants', 'gallery_assets',
    'gallery_tags', 'asset_tags', 'ideas', 'audience_entries', 'content_items', 'content_versions',
    'content_calendar', 'content_assets', 'generation_history', 'content_feedback', 'analytics_entries',
    'highlight_collections', 'highlight_items', 'filming_sessions', 'filming_session_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select private.is_member(workspace_id)))
         with check ((select private.is_member(workspace_id)))',
      t || '_member_access', t
    );
  end loop;
end;
$$;

-- Data API exposure: tables are not exposed automatically, grant explicitly.
-- No anon access anywhere: this is a private studio.
grant usage on schema public to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, delete on public.workspace_invites to authenticated;
grant select, insert, update, delete on
  public.content_pillars, public.brand_brain_entries, public.templates, public.template_variants,
  public.gallery_assets, public.gallery_tags, public.asset_tags, public.ideas, public.audience_entries,
  public.content_items, public.content_versions, public.content_calendar, public.content_assets,
  public.generation_history, public.content_feedback, public.analytics_entries,
  public.highlight_collections, public.highlight_items, public.filming_sessions, public.filming_session_items
  to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, paths prefixed with the workspace id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery', 'gallery', false, 209715200, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]),
  ('brand', 'brand', false, 10485760, array['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy studio_storage_select on storage.objects for select to authenticated
  using (bucket_id in ('gallery', 'brand') and (select private.is_member_of_path(name)));
create policy studio_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('gallery', 'brand') and (select private.is_member_of_path(name)));
create policy studio_storage_update on storage.objects for update to authenticated
  using (bucket_id in ('gallery', 'brand') and (select private.is_member_of_path(name)))
  with check (bucket_id in ('gallery', 'brand') and (select private.is_member_of_path(name)));
create policy studio_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('gallery', 'brand') and (select private.is_member_of_path(name)));
