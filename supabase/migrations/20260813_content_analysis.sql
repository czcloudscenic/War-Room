-- 20260813_content_analysis.sql
-- Content Intel port from Studio Intel (analysis core only, made multi-tenant).
-- APPLY BY HAND in the Supabase SQL editor BEFORE pushing any code that uses
-- these tables. Additive + idempotent. Safe to re-run.
--
-- Pre-flight NOTE (resolved): the port guide assumed account_posts.id is uuid.
-- In this schema account_posts.id is BIGSERIAL (20260601_connected_accounts.sql),
-- so account_post_id below is BIGINT. Verified against the live schema map.

-- ─────────────────────────────────────────────────────────────
-- 1. content_analysis: computed rates + AI read, one row per synced post per client
-- ─────────────────────────────────────────────────────────────
create table if not exists public.content_analysis (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  account_post_id bigint not null references public.account_posts(id) on delete cascade,
  views           integer,
  reach           integer,
  send_rate       numeric,      -- sends/views (the reach engine)
  save_rate       numeric,      -- saves/views
  follow_rate     numeric,      -- follows/reach (null: IG does not expose follows per-media)
  hook_hold       numeric,      -- avg_watch_sec / video_length_sec (null when length unknown)
  pillar          text check (pillar is null or pillar in ('TOF','MOF','BOF','glue')),
  ai_verdict      text,         -- winner | loser | normal
  ai_notes        jsonb,
  model           text,
  computed_at     timestamptz default now(),
  unique (client_id, account_post_id)
);
create index if not exists content_analysis_client_idx
  on public.content_analysis (client_id, computed_at desc);

-- ─────────────────────────────────────────────────────────────
-- 2. content_ideas: the AI idea queue, per client. Approval NEVER posts anything.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.content_ideas (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  hook           text,
  pillar         text,
  angle          text,
  script         text,
  signal         text,
  format         text default 'reel',
  fit_score      numeric default 0,
  status         text default 'draft' check (status in ('draft','approved','rejected','posted')),
  source_context jsonb,
  model          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists content_ideas_client_idx
  on public.content_ideas (client_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. content_benchmarks: the bars to beat, per client. No seeds; code falls
-- back to Studio's proven defaults (send 0.013, follow 0.0006, save 0.005).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.content_benchmarks (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  key       text not null,        -- send_rate | follow_rate | save_rate
  label     text,
  value     numeric,
  source    text,
  unique (client_id, key)
);

-- ─────────────────────────────────────────────────────────────
-- 4. clients.content_pillars: per-client pillar taxonomy (Studio hardcoded these)
-- ─────────────────────────────────────────────────────────────
alter table public.clients add column if not exists content_pillars jsonb
  default '[
    {"key":"TOF","label":"Reach","desc":"Cold reach. Judged on views and shares."},
    {"key":"MOF","label":"Trust","desc":"Proof, builds, teardowns. Judged on saves and watch time."},
    {"key":"BOF","label":"Offer","desc":"Conversion posts. Judged on DM opens and joins."}
  ]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS: admin-domain on every new table (house pattern). Portal users see
-- NOTHING (no client policy on purpose, v1).
-- ─────────────────────────────────────────────────────────────
alter table public.content_analysis enable row level security;
drop policy if exists "admin all content_analysis" on public.content_analysis;
create policy "admin all content_analysis" on public.content_analysis
  for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

alter table public.content_ideas enable row level security;
drop policy if exists "admin all content_ideas" on public.content_ideas;
create policy "admin all content_ideas" on public.content_ideas
  for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

alter table public.content_benchmarks enable row level security;
drop policy if exists "admin all content_benchmarks" on public.content_benchmarks;
create policy "admin all content_benchmarks" on public.content_benchmarks
  for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Sanity checks (run after applying; all commented)
-- select count(*) from public.content_analysis;
-- select count(*) from public.content_ideas;
-- select count(*) from public.content_benchmarks;
-- select column_name from information_schema.columns
--   where table_name = 'clients' and column_name = 'content_pillars';
-- select tablename, policyname, roles from pg_policies
--   where tablename in ('content_analysis','content_ideas','content_benchmarks') order by 1;
