-- ────────────────────────────────────────────────────────────────────────────
-- agent_events — one row per agent action invocation
-- Replaces the fake ACTIVITY_POOL theater with real, queryable event history.
-- Written by netlify/functions/agent-action.js via SUPABASE_SERVICE_KEY,
-- read by the ActivityFeed component (+ future "what did agent X do today" queries).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_events (
  id              bigserial primary key,
  ts              timestamptz not null default now(),
  agent_name      text not null,                 -- "Muse", "Sean", "Lacey", etc.
  action_key      text not null,                 -- "muse_write_content", "sean_briefing", ...
  content_item_id text,                          -- nullable; FK omitted until content_items schema is canonical
  payload         jsonb,                         -- request body (input args)
  result_status   text,                          -- "success" | "error" | "skipped"
  result_summary  text                           -- short human-readable summary, capped client-side
);

create index if not exists agent_events_ts_idx    on public.agent_events (ts desc);
create index if not exists agent_events_agent_idx on public.agent_events (agent_name);
create index if not exists agent_events_action_idx on public.agent_events (action_key);

alter table public.agent_events enable row level security;

-- Production policy: only @cloudscenic.com Google Workspace users can read
-- (works once Supabase Auth is restored — currently auth is bypassed in App.jsx).
create policy "admins read all"
  on public.agent_events
  for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- TEMPORARY policy while auth is bypassed: allow anon reads so the live
-- ActivityFeed renders. DROP THIS POLICY once Google OAuth is re-enabled.
create policy "anon read while auth bypassed (TODO remove)"
  on public.agent_events
  for select
  using (true);

-- Writes happen exclusively via SUPABASE_SERVICE_KEY (Netlify functions),
-- which bypasses RLS entirely — no insert policy needed.

-- ──────────────────────────────────────────────────────────────────────────────
-- Realtime: enable Supabase Realtime on this table so ActivityFeed gets
-- live updates. If the publication doesn't exist (fresh Supabase project),
-- create it first.
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.agent_events;
