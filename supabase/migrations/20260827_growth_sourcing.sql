-- Growth sourcing + warmth (port of Dynasty Lead Finder / Website Generator mechanics)
-- Spec: docs/GROWTH-PORT-SPEC.md. Idempotent + additive. Everything created PAUSED.

-- 1. ICPs per client (agency-level ICPs live under the CloudScenic client)
create table if not exists public.client_icps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,                           -- "Roofers - Inland Empire"
  niche text not null,                          -- Places search phrase: "roofing contractor"
  cities jsonb not null default '[]'::jsonb,    -- ["Riverside, CA", "Ontario, CA"]
  exclude_names jsonb not null default '[]'::jsonb, -- extra chain/competitor drops
  fit_rules jsonb not null default '{}'::jsonb, -- {min_reviews, require_website}
  -- Trigger signal is CONFIG, not code: [{kind:'careers_page'} | {kind:'job_board', query:'forklift'} |
  -- {kind:'ad_library', query:'...'} | {kind:'community_launch', query:'...'}]. v1 wires careers_page.
  signal_sources jsonb not null default '[{"kind":"careers_page"}]'::jsonb,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists client_icps_client_idx on public.client_icps (client_id);

-- 2. Sourcing runs — every Places sweep is a row; daily cap = count of requests today
create table if not exists public.sourcing_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  icp_id uuid references public.client_icps(id) on delete set null,
  status text not null default 'paused'
    check (status in ('paused','running','done','failed')),
  city text,
  requests integer not null default 0,          -- Places calls spent
  found integer not null default 0,
  inserted integer not null default 0,
  error text,
  created_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sourcing_runs_client_idx on public.sourcing_runs (client_id, created_at desc);

-- 3. leads grows: tenant + ICP + signal + contact channel + warmth
alter table public.leads add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.leads add column if not exists icp_id uuid references public.client_icps(id) on delete set null;
alter table public.leads add column if not exists place_id text;
alter table public.leads add column if not exists rating numeric;
alter table public.leads add column if not exists review_count integer;
alter table public.leads add column if not exists fit text check (fit in ('high','medium','low'));
alter table public.leads add column if not exists contact_email text;
alter table public.leads add column if not exists direct_phone text;
alter table public.leads add column if not exists apollo_id text;
alter table public.leads add column if not exists signal_kind text;          -- 'careers_page' | 'job_board'
alter table public.leads add column if not exists signal_role text;
alter table public.leads add column if not exists signal_url text;
alter table public.leads add column if not exists signal_posted_at timestamptz;
alter table public.leads add column if not exists signal_verified_at timestamptz;
alter table public.leads add column if not exists warmth_score integer not null default 0;
alter table public.leads add column if not exists warmth_band text not null default 'cold' check (warmth_band in ('warm','warming','cold'));
alter table public.leads add column if not exists warmth_reasons jsonb not null default '[]'::jsonb;
alter table public.leads add column if not exists warmth_at timestamptz;
alter table public.leads add column if not exists warm_since timestamptz;
alter table public.leads add column if not exists last_engaged_at timestamptz;
alter table public.leads add column if not exists last_engagement text;
alter table public.leads add column if not exists optout boolean not null default false;
create unique index if not exists leads_place_uidx on public.leads (place_id) where place_id is not null;
create index if not exists leads_warmth_idx on public.leads (warmth_band, warmth_score desc);
create index if not exists leads_client_idx on public.leads (client_id, stage);

-- 4. lead_events — behavior signals (what promotes warmth). Monotonic per brief.
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  brief_id uuid references public.lead_briefs(id) on delete set null,
  kind text not null check (kind in ('sent','delivered','opened','clicked','replied','bounced','complained','call_answered','call_voicemail','call_gatekeeper','call_back')),
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, at desc);
alter table public.lead_briefs add column if not exists last_event text;
alter table public.lead_briefs add column if not exists delivered_at timestamptz;
alter table public.lead_briefs add column if not exists opened_at timestamptz;
alter table public.lead_briefs add column if not exists clicked_at timestamptz;
alter table public.lead_briefs add column if not exists replied_at timestamptz;

-- 5. budget/caps (Places daily, Apollo monthly) — one settings row
create table if not exists public.growth_budget (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.growth_budget (key, value) values
  ('places', '{"daily_cap": 300}'::jsonb),
  ('apollo', '{"email_cap": 100, "phone_cap": 20}'::jsonb)
on conflict (key) do nothing;

-- RLS: admin-domain on the new tables (leads/lead_briefs already covered)
alter table public.client_icps enable row level security;
alter table public.sourcing_runs enable row level security;
alter table public.lead_events enable row level security;
alter table public.growth_budget enable row level security;
do $$ declare t text; begin
  foreach t in array array['client_icps','sourcing_runs','lead_events','growth_budget'] loop
    execute format('drop policy if exists "admins all %1$s" on public.%1$s', t);
    execute format('create policy "admins all %1$s" on public.%1$s for all using ((auth.jwt() ->> ''email'') like ''%%@cloudscenic.com'') with check ((auth.jwt() ->> ''email'') like ''%%@cloudscenic.com'')', t);
  end loop;
end $$;

-- Verify: select count(*) from public.client_icps; select value from public.growth_budget;
