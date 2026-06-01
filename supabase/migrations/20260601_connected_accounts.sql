-- Connected social accounts schema — 2026-06-01
-- Foundation for the IG/TT/YT/LinkedIn analyzer pivot. Designed to work for
-- all 4 platforms via a single (platform, platform_account_id) shape.
--
-- Tokens live in a separate table (connected_account_tokens) with NO RLS
-- policies — only service-role Netlify functions can read/write them.
-- This way a user reading their own connected_accounts row can never leak
-- a token even if RLS on the metadata table is misconfigured.
--
-- Apply: paste into Supabase SQL editor and run.

-- ── connected_accounts (public-ish metadata) ────────────────────────────────
create table if not exists public.connected_accounts (
  id                  bigserial primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  platform            text not null check (platform in ('instagram','tiktok','youtube','linkedin')),
  platform_account_id text not null,
  handle              text,            -- @username, channel name, etc.
  display_name        text,
  avatar_url          text,
  fetched_at          timestamptz,     -- last successful sync
  meta                jsonb not null default '{}'::jsonb,  -- platform-specific extras (e.g. fb_page_id for IG)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, platform, platform_account_id)
);

create index if not exists connected_accounts_user_id_idx on public.connected_accounts(user_id);
create index if not exists connected_accounts_platform_idx on public.connected_accounts(platform);

alter table public.connected_accounts enable row level security;

-- Admins (@cloudscenic.com email) see/manage everything
create policy "admins manage connected_accounts"
  on public.connected_accounts
  for all
  to authenticated
  using (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com')
  with check (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com');

-- Regular users see + manage only their own
create policy "users read own connected_accounts"
  on public.connected_accounts
  for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own connected_accounts"
  on public.connected_accounts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own connected_accounts"
  on public.connected_accounts
  for update to authenticated
  using (user_id = auth.uid());

create policy "users delete own connected_accounts"
  on public.connected_accounts
  for delete to authenticated
  using (user_id = auth.uid());


-- ── connected_account_tokens (secrets — service-role only) ──────────────────
-- No RLS policies = no access for any authenticated user. Service-role bypasses
-- RLS, so Netlify Functions (sync/refresh/OAuth callback) can read/write freely.
create table if not exists public.connected_account_tokens (
  account_id         bigint primary key references public.connected_accounts(id) on delete cascade,
  access_token       text not null,
  refresh_token      text,
  token_expires_at   timestamptz,
  scopes             text,
  updated_at         timestamptz not null default now()
);

alter table public.connected_account_tokens enable row level security;
-- intentionally no policies — RLS denies all authenticated access.


-- ── account_posts (recent posts pulled from each connected account) ─────────
create table if not exists public.account_posts (
  id                bigserial primary key,
  account_id        bigint not null references public.connected_accounts(id) on delete cascade,
  platform_post_id  text not null,
  posted_at         timestamptz,
  media_type        text,             -- 'image' | 'video' | 'carousel' | 'reel' | 'short'
  caption           text,
  permalink         text,
  thumbnail_url     text,
  metrics           jsonb not null default '{}'::jsonb,  -- likes, comments, reach, impressions, saves, shares, etc.
  raw               jsonb not null default '{}'::jsonb,  -- full raw API response for debugging
  fetched_at        timestamptz not null default now(),
  unique (account_id, platform_post_id)
);

create index if not exists account_posts_account_posted_idx on public.account_posts(account_id, posted_at desc);
create index if not exists account_posts_metrics_engagement_idx on public.account_posts((metrics->>'engagement_rate'));

alter table public.account_posts enable row level security;

-- Admins see all
create policy "admins manage account_posts"
  on public.account_posts
  for all
  to authenticated
  using (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com')
  with check (lower((auth.jwt() ->> 'email')) like '%@cloudscenic.com');

-- Users see posts only from their own connected accounts
create policy "users read own account_posts"
  on public.account_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.connected_accounts ca
      where ca.id = public.account_posts.account_id
        and ca.user_id = auth.uid()
    )
  );


-- ── oauth_states (CSRF protection during OAuth flow) ────────────────────────
-- Short-lived state tokens; created when user clicks "Connect X", verified on
-- callback. Service-role only — no user-facing reads needed.
create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null,
  redirect_to text,                                          -- where to send user after callback
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists oauth_states_user_id_idx on public.oauth_states(user_id);

alter table public.oauth_states enable row level security;
-- no policies = service-role only
