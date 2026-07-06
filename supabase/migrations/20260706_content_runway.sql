-- ────────────────────────────────────────────────────────────────────────────
-- Content Runway Tracker (spec 2026-07-06).
--
-- Why: Dynasty ran out of content with no warning — nothing tracked inventory
-- or the scheduled queue, and nobody was alerted. This adds the runway layer:
--
--   1. Structured runway config on clients — posts_per_week (numeric burn
--      fallback; the existing `cadence` column is free text and unusable for
--      math), shoot lead time, tracking toggle, Sprout profile mapping.
--   2. runway_alert_state — re-fire bookkeeping for the daily
--      content-runway-check cron (one row per client, admin-only).
--
-- Inventory itself is NOT a new table: it derives from content_items
-- (posted_at is null), and the scheduled queue derives from the Sprout API.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor
-- (project wjcstqqihtebkpyuacop) BEFORE deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. Runway config on clients ───────────────────────────────────────────────
alter table public.clients add column if not exists posts_per_week numeric;
  -- fallback burn rate when Sprout / posted_at history is unavailable
alter table public.clients add column if not exists shoot_lead_time_days integer default 14;
  -- days needed to book + shoot + edit; the alert fires when runway < this
alter table public.clients add column if not exists content_tracking_enabled boolean default false;
  -- only tracked clients appear in runway UI, alerts, and the Monday digest
alter table public.clients add column if not exists sprout_profile_ids jsonb default '[]'::jsonb;
  -- Sprout Social customer profile ids for this client, e.g. [1234567]
  -- (jsonb array: one client can own several platform profiles)

-- ── 2. Alert re-fire bookkeeping ──────────────────────────────────────────────
-- One row per client. The cron reads/writes this to implement re-fire cadence
-- (warning every 3d, critical/empty daily) and to record auto-clears when the
-- queue extends. Alert *content* still flows through the notifications table
-- (dedupe_key convention) — this is only the state machine.
create table if not exists public.runway_alert_state (
  client_id      uuid primary key references public.clients(id) on delete cascade,
  severity       text check (severity in ('warning', 'critical', 'empty')),
  last_alert_at  timestamptz,
  cleared_at     timestamptz,
  -- snapshot of the numbers behind the last alert, for the card + debugging:
  last_snapshot  jsonb default '{}'::jsonb,
  -- { runway_days, queue_end_date, inventory_ready, inventory_production,
  --   burn_per_day, burn_source: 'sprout'|'posted_at'|'cadence' }
  updated_at     timestamptz default now()
);

alter table public.runway_alert_state enable row level security;

-- Admin-only, client_vault shape: portal + anon read ZERO rows on purpose —
-- runway state is internal ops, never client-facing.
drop policy if exists "admins full access" on public.runway_alert_state;
create policy "admins full access"
  on public.runway_alert_state
  for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- ── 3. Seed: runway config for known clients ──────────────────────────────────
-- posts_per_week derived from the cadence strings seeded 2026-07-02.
-- CHRISTIAN: adjust numbers here (or later on the client editor) if reality
-- differs. Vital Lyfe is brief-lane → no cadence, tracking stays off.
do $$
begin
  update public.clients set
    posts_per_week = coalesce(posts_per_week, 10),   -- '2 posts/day Mon-Fri (10/wk)'
    content_tracking_enabled = true
  where name ilike '%dynasty%';

  update public.clients set
    posts_per_week = coalesce(posts_per_week, 4),    -- '2 videos + 2 flyers/wk'
    content_tracking_enabled = true
  where name ilike '%parlour%';
end $$;

-- Sanity checks (run after applying):
-- select name, posts_per_week, shoot_lead_time_days, content_tracking_enabled,
--        sprout_profile_ids from public.clients order by name;
-- select * from public.runway_alert_state;
