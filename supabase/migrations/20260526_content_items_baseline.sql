-- Fix #10 — content_items baseline migration.
--
-- Until now content_items lived only in production Supabase with no
-- version-controlled definition. This file is the canonical source of
-- truth as of 2026-05-26. Pulled from live via the schema-dump query in
-- /tmp/content_items-schema-pull.sql; reviewed and reformatted.
--
-- Idempotent: safe to run against the existing production DB (which already
-- has the table) or a fresh dev DB (which doesn't).
--
-- ────────────────────────────────────────────────────────────────────────
-- ⚠️ The "Allow all for now" policy near the bottom of this file is a
-- legacy wide-open temp policy. It's captured here for historical fidelity
-- (this is what was live in prod as of 2026-05-26) — but it's REPLACED in
-- the follow-up migration 20260526_content_items_client_rls.sql by scoped
-- SELECT + UPDATE policies for approved external clients.
--
-- If you're running migrations against a fresh DB, run this file FIRST,
-- then the _client_rls.sql one. Together they produce the correct
-- end state: admin full access + external client scoped access + zero
-- anonymous access.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.content_items (
  id            text primary key,
  title         text not null,
  description   text,
  campaign      text,
  platform      text,
  type          text,
  format        text,
  stage         text,
  status        text,
  pillar        text,
  platforms     text[],
  script        text,
  caption       text,
  cta           text,
  hashtags      text,
  seo_keywords  text,
  notes         text,
  start_week    integer,
  duration      integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  files         jsonb default '[]'::jsonb,
  publish_date  text,
  client_note   text,
  client_id     uuid references public.clients(id) on delete cascade
);

-- Per-client filtering index — the dashboard queries content_items
-- by client_id on nearly every page load and realtime subscription.
create index if not exists content_items_client_idx
  on public.content_items (client_id);

-- RLS — already enabled in prod; explicit here so fresh DBs match.
alter table public.content_items enable row level security;

-- ── Admin policies (@cloudscenic.com gets full read + write) ──
-- Pattern mirrors 20260525_admin_rls_for_oauth.sql.

drop policy if exists "admins read content_items" on public.content_items;
create policy "admins read content_items"
  on public.content_items for select
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

drop policy if exists "admins write content_items" on public.content_items;
create policy "admins write content_items"
  on public.content_items for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ── ⚠️ TEMP wide-open policy (security debt — see header) ──
drop policy if exists "Allow all for now" on public.content_items;
create policy "Allow all for now"
  on public.content_items for all
  using (true);

-- ────────────────────────────────────────────────────────────────────────
-- The wide-open "Allow all for now" policy above is dropped in the
-- follow-up migration: 20260526_content_items_client_rls.sql
-- ────────────────────────────────────────────────────────────────────────
