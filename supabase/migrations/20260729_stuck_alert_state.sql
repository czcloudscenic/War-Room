-- ────────────────────────────────────────────────────────────────────────────
-- stuck_alert_state — re-fire bookkeeping for the stuck-item bottleneck cron
-- (check-stuck-items, M5). Cloned from the runway_alert_state pattern: one row
-- per stuck item; the daily cron reads/writes it to implement re-fire cadence
-- (48h) and auto-clears when the item moves. Alert *content* still flows
-- through the notifications table (dedupe_key convention) — this is only the
-- state machine.
--
-- Additive + idempotent. Apply in the Vantus Supabase SQL editor BEFORE
-- deploying the matching app code.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.stuck_alert_state (
  content_item_id  text primary key references public.content_items(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete cascade,
  status           text,              -- the pipeline status it's stuck in
  stuck_days       integer,           -- days past threshold at last check
  first_detected_at timestamptz,
  last_alert_at    timestamptz,
  cleared_at       timestamptz,       -- set when the item moves; row kept for history
  task_id          uuid,              -- the auto-created "Unstick:" tasks row, for auto-complete
  last_snapshot    jsonb default '{}'::jsonb,
  updated_at       timestamptz default now()
);

alter table public.stuck_alert_state enable row level security;

-- Admin-only, runway_alert_state shape: internal ops, never client-facing.
drop policy if exists "admins full access" on public.stuck_alert_state;
create policy "admins full access"
  on public.stuck_alert_state
  for all
  using ((auth.jwt() ->> 'email') like '%@cloudscenic.com')
  with check ((auth.jwt() ->> 'email') like '%@cloudscenic.com');

-- Sanity check (run after applying):
-- select * from public.stuck_alert_state;
