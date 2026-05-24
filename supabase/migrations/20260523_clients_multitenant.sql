-- ────────────────────────────────────────────────────────────────────────────
-- Multi-tenancy foundation — clients table + client_id on data tables
-- Converts Vantus from single-tenant (VitalLyfe-hardcoded) to multi-tenant
-- (Cloud Scenic agency OS) where each client gets their own scoped data.
--
-- After this migration:
--   • New clients are added via Vantus UI (no SQL needed per client)
--   • All content_items / agent_events / notifications scoped by client_id
--   • Per-client integration config (slack, n8n, email) lives on the row
-- ────────────────────────────────────────────────────────────────────────────

-- 1. clients table
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,        -- url-safe identifier
  name                  text not null,               -- display name
  brand_voice_md        text,                        -- markdown brand voice (seed for agent prompts)
  brand_color           text,                        -- hex color
  logo_url              text,                        -- public URL
  primary_email         text,                        -- notifications recipient
  slack_channel_id      text,                        -- per-client #channel (optional)
  n8n_webhook_url       text,                        -- per-client automation (optional)
  status                text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at            timestamptz not null default now(),
  archived_at           timestamptz
);

create index if not exists clients_status_idx on public.clients (status);

alter table public.clients enable row level security;

-- All admins can read all clients (single-tenant assumption for Phase A —
-- per-user assignments can come later in Phase B if needed)
create policy "admins read clients"
  on public.clients for select
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com');

create policy "admins write clients"
  on public.clients for all
  using (auth.jwt() ->> 'email' like '%@cloudscenic.com')
  with check (auth.jwt() ->> 'email' like '%@cloudscenic.com');

-- TEMPORARY anon policy while OAuth bypassed. TODO: drop when auth restored.
create policy "anon read clients (TODO remove)"
  on public.clients for select using (true);
create policy "anon write clients (TODO remove)"
  on public.clients for all using (true) with check (true);

-- Realtime so the client picker updates live across tabs
alter publication supabase_realtime add table public.clients;

-- 2. Seed VitalLyfe as the first client (will own all existing rows)
insert into public.clients (slug, name, brand_color, primary_email, slack_channel_id, brand_voice_md)
values (
  'vitallyfe',
  'VitalLyfe',
  '#2AABFF',
  'natalia@vitallyfe.com',
  'C0AM0UU4G4R',  -- #vitallyfe-war-room
  'Calm, confident, purposeful. Never corporate. Movement, not product. Avoid generic wellness language, overclaiming, stock-feeling visuals.'
)
on conflict (slug) do nothing;

-- 3. Add client_id to existing data tables (nullable for now — backfill below,
-- then a follow-up migration can set NOT NULL once verified)

alter table public.content_items
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table public.agent_events
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table public.notifications
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- 4. Backfill: tag all existing rows as VitalLyfe's data
do $$
declare
  vl_id uuid;
begin
  select id into vl_id from public.clients where slug = 'vitallyfe';
  if vl_id is null then
    raise exception 'VitalLyfe seed row missing — clients seed must run first';
  end if;
  update public.content_items  set client_id = vl_id where client_id is null;
  update public.agent_events   set client_id = vl_id where client_id is null;
  update public.notifications  set client_id = vl_id where client_id is null;
end $$;

-- 5. Indexes for scoped queries (every list endpoint will filter by client_id + sort by ts)
create index if not exists content_items_client_idx on public.content_items (client_id);
create index if not exists agent_events_client_ts_idx on public.agent_events (client_id, ts desc);
create index if not exists notifications_client_ts_idx on public.notifications (client_id, ts desc);

-- Note: NOT making client_id NOT NULL yet. A future migration will, once we've
-- verified all app code is reliably setting it on inserts and the backfill is clean.
